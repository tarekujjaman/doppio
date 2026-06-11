import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { processSession } from "@/lib/pipeline/process-session";
import { getTranscribeDecision } from "@/lib/quota";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby ceiling — bounds the inline pipeline

const BodySchema = z.object({
  durationSec: z.number().int().positive().max(24 * 3600).optional(),
});

/**
 * Called after the client finishes the Storage upload: final quota gate,
 * then runs the transcribe pipeline after the response is sent (`after()`),
 * keeping the request snappy while the function stays alive to finish work.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({ where: { id, userId: user.id } });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);
  if (session.status !== "UPLOADED") {
    return apiError("INVALID_STATE", `Session is ${session.status}, expected UPLOADED`, 409);
  }
  if (!session.audioKey) return apiError("NO_AUDIO", "No audio uploaded for this session", 409);

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  const durationSec = parsed.success ? (parsed.data.durationSec ?? session.durationSec ?? 60) : 60;

  const decision = await getTranscribeDecision(user.id, durationSec);
  if (!decision.allowed) {
    return apiError(decision.reason, "Transcription quota exceeded", 402);
  }

  if (durationSec !== session.durationSec) {
    await prisma.session.update({ where: { id }, data: { durationSec } });
  }

  after(async () => {
    try {
      await processSession(id);
    } catch (err) {
      console.error(`pipeline failed for session ${id}:`, err);
    }
  });

  return NextResponse.json({ ok: true, status: "TRANSCRIBING" }, { status: 202 });
}
