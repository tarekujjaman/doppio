import { prisma } from "@doppio/db";
import { createSttProvider } from "@doppio/stt";
import { indexSession } from "@/lib/pipeline/index-session";
import { summarizeSession } from "@/lib/pipeline/summarize-session";
import { ensureTwinMindFormat } from "@/lib/pipeline/transcode";
import { deleteAudio, downloadAudio } from "@/lib/storage";

/**
 * Inline processing pipeline (replaces the BullMQ worker on the free stack).
 * Runs inside a maxDuration=300 route via next/server `after()`.
 * Status walk: UPLOADED → TRANSCRIBING → SUMMARIZING → READY | FAILED.
 * TODO(queue): move to a durable queue for >300s audio jobs.
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

    // Normalize to a TwinMind-accepted format (webm/mp4 → wav) so the PRIMARY
    // STT always transcribes — no silent fall back to the weaker Whisper path.
    const normalized = await ensureTwinMindFormat(audio, filename);

    const result = await stt.transcribeFile({
      audio: normalized,
      languageHint: "auto",
    });

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
