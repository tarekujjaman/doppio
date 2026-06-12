import { prisma } from "@doppio/db";
import { createSttProvider } from "@doppio/stt";
import { indexSession } from "@/lib/pipeline/index-session";
import { summarizeSession } from "@/lib/pipeline/summarize-session";
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

    const result = await stt.transcribeFile({
      audio: { data: audio, filename, contentType: guessContentType(filename) },
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

    // INIT-18: private mode discards audio once the transcript exists.
    if (session.privateMode) {
      await deleteAudio(session.audioKey);
      await prisma.session.update({ where: { id: sessionId }, data: { audioKey: null } });
    }

    // AI layer (MVP-01/04/07). A summarize failure must not lose the transcript:
    // the session still becomes READY and the summary can be regenerated.
    try {
      await summarizeSession(sessionId, { setTitleAndTags: true });
    } catch (err) {
      console.error(`summarize failed for session ${sessionId}:`, err);
    }

    // RAG index for Ask Doppio (MVP-10) — best-effort, same degradation rule.
    try {
      await indexSession(sessionId);
    } catch (err) {
      console.error(`indexing failed for session ${sessionId}:`, err);
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

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    flac: "audio/flac",
    ogg: "audio/ogg",
    webm: "audio/webm",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

function normalizeLanguage(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("bn") || l.includes("bengali") || l.includes("bangla")) return "bn";
  if (l === "mixed") return "mixed";
  if (l.startsWith("en") || l.includes("english")) return "en";
  return l || "unknown";
}
