import { prisma } from "@doppio/db";
import { createSttProvider } from "@doppio/stt";
import { indexSession } from "@/lib/pipeline/index-session";
import { summarizeSession } from "@/lib/pipeline/summarize-session";
import { ensureTwinMindFormat } from "@/lib/pipeline/transcode";
import { transcribeAudio } from "@/lib/pipeline/transcribe-audio";
import { deleteAudio, downloadAudio } from "@/lib/storage";

// Hard budget for convert+transcribe, comfortably under the 300s function limit
// so an overrun fails cleanly (FAILED) instead of hanging forever in TRANSCRIBING.
const TRANSCRIBE_BUDGET_MS = 240_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Inline processing pipeline (replaces the BullMQ worker on the free stack).
 * Runs inside a maxDuration=300 route via next/server `after()`.
 * Status walk: UPLOADED → TRANSCRIBING → SUMMARIZING → READY | FAILED.
 * Long audio is chunked + transcribed in parallel; a time budget guarantees a
 * clean FAILED rather than a stuck session. TODO(queue): durable async for huge files.
 */
export async function processSession(sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error(`session ${sessionId} not found`);
  if (!session.audioKey) throw new Error(`session ${sessionId} has no audio`);

  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "TRANSCRIBING" },
    });

    const audio = await downloadAudio(session.audioKey);
    const stt = createSttProvider();
    const filename = session.audioKey.split("/").pop() ?? "audio";

    // Convert (webm/mp4 → wav so the PRIMARY STT always handles it) + transcribe
    // (long WAVs are chunked + run in parallel), bounded by a time budget so an
    // over-long recording fails cleanly instead of hanging in TRANSCRIBING.
    const result = await withTimeout(
      (async () => {
        const normalized = await ensureTwinMindFormat(audio, filename);
        return transcribeAudio(stt, normalized, session.durationSec ?? 0);
      })(),
      TRANSCRIBE_BUDGET_MS,
      "Transcription exceeded the time budget — the recording may be too long.",
    );

    const durationSec = result.segments.length
      ? Math.ceil(Math.max(...result.segments.map((s) => s.endMs)) / 1000)
      : (session.durationSec ?? 0);

    await prisma.$transaction([
      prisma.transcriptSegment.deleteMany({ where: { sessionId } }),
      prisma.transcriptSegment.createMany({
        data: result.segments.map((s, idx) => ({
          sessionId,
          idx,
          startMs: s.startMs,
          endMs: s.endMs,
          text: s.text,
          speaker: s.speaker ?? null,
        })),
      }),
      prisma.usageLedger.create({
        data: {
          userId: session.userId,
          kind: "transcribe_seconds",
          amount: durationSec,
          sessionId,
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: {
          status: "SUMMARIZING",
          language: normalizeLanguage(result.language),
          durationSec,
        },
      }),
    ]);

    // No audio retention (product decision + INIT-18): the transcript is the
    // asset. Discard the audio object as soon as the transcript exists; the
    // session keeps only transcript/summary/notes. Best-effort — a storage
    // hiccup must not fail an otherwise-good session.
    try {
      await deleteAudio(session.audioKey);
    } catch (err) {
      console.error(`audio cleanup failed for session ${sessionId}:`, err);
    }
    await prisma.session.update({ where: { id: sessionId }, data: { audioKey: null } });

    // AI layer (MVP-01/04/07) + RAG index (MVP-10) run in parallel — both read
    // the transcript and write disjoint tables. Each is best-effort: a failure
    // must not lose the transcript; the session still becomes READY and the
    // summary is regenerable.
    const [summary, index] = await Promise.allSettled([
      summarizeSession(sessionId, { setTitleAndTags: true }),
      indexSession(sessionId),
    ]);
    if (summary.status === "rejected") {
      console.error(`summarize failed for session ${sessionId}:`, summary.reason);
    }
    if (index.status === "rejected") {
      console.error(`indexing failed for session ${sessionId}:`, index.reason);
    }

    await prisma.session.update({ where: { id: sessionId }, data: { status: "READY" } });
  } catch (err) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "FAILED" },
    });
    throw err;
  }
}

function normalizeLanguage(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("bn") || l.includes("bengali") || l.includes("bangla")) return "bn";
  if (l === "mixed") return "mixed";
  if (l.startsWith("en") || l.includes("english")) return "en";
  return l || "unknown";
}
