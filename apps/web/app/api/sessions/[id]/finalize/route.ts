import { detectLanguage } from "@doppio/core";
import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { indexSession } from "@/lib/pipeline/index-session";
import { summarizeSession } from "@/lib/pipeline/summarize-session";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // bounds the inline summarize + index pass

const BodySchema = z.object({
  durationSec: z.number().int().positive().max(24 * 3600).optional(),
});

/**
 * Ends a live-capture session: the transcript is already in place (streamed in
 * via transcribe-chunk), so this meters once (server-derived from the segments),
 * then runs summary + action items + RAG index after the response (`after()`),
 * landing the session at READY within seconds of Stop.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { id: true, status: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);
  // Idempotent-ish: only a still-live session can be finalized.
  if (session.status !== "RECORDING" && session.status !== "TRANSCRIBING") {
    return apiError("INVALID_STATE", `Session is ${session.status}`, 409);
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  const clientDurationSec = parsed.success ? parsed.data.durationSec : undefined;

  const segments = await prisma.transcriptSegment.findMany({
    where: { sessionId: id },
    select: { endMs: true, text: true },
  });

  if (segments.length === 0) {
    await prisma.session.update({ where: { id }, data: { status: "FAILED" } });
    return apiError("INVALID_STATE", "No speech was transcribed", 409);
  }

  // Meter server-side from the transcript — never trust a client duration.
  const maxEndMs = Math.max(...segments.map((s) => s.endMs));
  const durationSec = Math.max(1, Math.ceil(maxEndMs / 1000)) || clientDurationSec || 1;
  const language = detectLanguage(segments.map((s) => s.text).join(" "));

  await prisma.$transaction([
    prisma.usageLedger.create({
      data: { userId: user.id, kind: "transcribe_seconds", amount: durationSec, sessionId: id },
    }),
    prisma.session.update({
      where: { id },
      data: { status: "SUMMARIZING", durationSec, language },
    }),
  ]);

  after(async () => {
    // Summarize first and flip to READY as soon as the summary (the user-visible asset)
    // lands — don't make the user wait on embeddings indexing, which only powers search/Ask.
    // The transcript is already in place, so READY is reached even if the AI layer hiccups.
    try {
      await summarizeSession(id, { setTitleAndTags: true });
    } catch (err) {
      console.error(`summarize failed for ${id}:`, err);
    } finally {
      await prisma.session.update({ where: { id }, data: { status: "READY" } }).catch(() => {});
    }
    // Index AFTER marking READY so retrieval catches up without delaying the session.
    try {
      await indexSession(id);
    } catch (err) {
      console.error(`indexing failed for ${id}:`, err);
    }
  });

  return NextResponse.json({ ok: true, status: "SUMMARIZING", durationSec }, { status: 202 });
}
