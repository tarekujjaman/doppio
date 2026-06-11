import { UPLOAD_ACCEPTED_TYPES } from "@doppio/core";
import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getTranscribeDecision } from "@/lib/quota";
import { createSignedUpload } from "@/lib/storage";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  durationSec: z.number().int().positive().max(24 * 3600).optional(),
  privateMode: z.boolean().optional(),
  source: z.enum(["UPLOAD", "EXTENSION"]).default("UPLOAD"),
  title: z.string().min(1).max(300).optional(),
});

/** Creates a pending Session + one-time signed Storage upload target (MVP-35). */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);
  const body = parsed.data;

  if (!(UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(body.contentType)) {
    return apiError("UNSUPPORTED_TYPE", `Unsupported content type: ${body.contentType}`, 415);
  }

  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? 100);
  if (body.sizeBytes > maxMb * 1024 * 1024) {
    return apiError("FILE_TOO_LARGE", `Max upload size is ${maxMb}MB`, 413);
  }

  // Early quota gate with the client-reported duration (final gate at ingest).
  const decision = await getTranscribeDecision(user.id, body.durationSec ?? 60);
  if (!decision.allowed) {
    return apiError(decision.reason, "Transcription quota exceeded", 402);
  }

  // Ensure profile exists before the FK write.
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email ?? null },
  });

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { privateMode: true },
  });

  const safeName = body.filename.replace(/[^\w.\-]+/g, "_").slice(-100);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: body.title ?? body.filename,
      source: body.source,
      status: "UPLOADED",
      privateMode: body.privateMode ?? profile.privateMode,
      durationSec: body.durationSec ?? null,
    },
  });

  const key = `${user.id}/${session.id}/${safeName}`;
  const upload = await createSignedUpload(key);

  await prisma.session.update({ where: { id: session.id }, data: { audioKey: key } });

  return NextResponse.json({
    sessionId: session.id,
    bucket: "doppio-audio",
    path: upload.path,
    token: upload.token,
  });
}
