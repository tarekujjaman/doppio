import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getTranscribeDecision } from "@/lib/quota";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  source: z.enum(["EXTENSION", "MOBILE"]).default("EXTENSION"),
  privateMode: z.boolean().optional(),
});

/**
 * Opens a live-capture session up front (status RECORDING) so the client can
 * stream transcribe-chunk calls against it while the meeting is still going.
 * No audio is stored: chunks are POSTed straight to /transcribe-chunk, kept only
 * in the function's memory for the length of one transcription, then discarded.
 * The final quota meter lands in /finalize (server-derived from the transcript).
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);
  const body = parsed.data;

  // Early gate (nominal): block already-over-quota users before they record.
  const decision = await getTranscribeDecision(user.id, 60);
  if (!decision.allowed) return apiError(decision.reason, "Transcription quota exceeded", 402);

  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email ?? null },
  });
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { privateMode: true },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: body.title ?? "Live recording",
      source: body.source,
      status: "RECORDING",
      privateMode: body.privateMode ?? profile.privateMode,
    },
  });

  return NextResponse.json({ sessionId: session.id });
}
