import { prisma } from "@doppio/db";
import { createSttProvider } from "@doppio/stt";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60; // a single ~90s chunk transcribes in seconds

// Each chunk owns a disjoint idx band so out-of-order arrival and retries stay
// ordered + idempotent. 100k per chunk dwarfs any real per-chunk segment count.
const IDX_STRIDE = 100_000;
// 90s @ 16kHz mono 16-bit ≈ 2.9MB; cap well under Vercel's ~4.5MB body limit.
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * Transcribes ONE audio chunk and appends its segments to the live session.
 * The WAV bytes are the raw request body; index + startMs come from the query.
 * Audio is never persisted — it lives only in memory for this one call.
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
  if (session.status !== "RECORDING" && session.status !== "TRANSCRIBING") {
    return apiError("INVALID_STATE", `Session is ${session.status}, expected RECORDING`, 409);
  }

  const url = new URL(request.url);
  const index = Number(url.searchParams.get("index"));
  const chunkStartMs = Math.max(0, Math.round(Number(url.searchParams.get("startMs") ?? 0)));
  if (!Number.isInteger(index) || index < 0) {
    return apiError("INVALID_BODY", "Missing or invalid chunk index", 400);
  }

  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength === 0) return apiError("INVALID_BODY", "Empty chunk", 400);
  if (buf.byteLength > MAX_CHUNK_BYTES) return apiError("FILE_TOO_LARGE", "Chunk too large", 413);

  const stt = createSttProvider();
  const result = await stt.transcribeFile({
    audio: { data: buf, filename: `chunk-${index}.wav`, contentType: "audio/wav" },
    languageHint: "auto",
  });

  const base = index * IDX_STRIDE;
  const rows = result.segments
    .filter((s) => s.text.trim().length > 0)
    .map((s, i) => ({
      sessionId: id,
      idx: base + i,
      startMs: chunkStartMs + s.startMs,
      endMs: chunkStartMs + s.endMs,
      text: s.text,
      speaker: s.speaker ?? null,
    }));

  // Replace-in-place for this chunk's band so a retried chunk doesn't duplicate.
  await prisma.$transaction([
    prisma.transcriptSegment.deleteMany({
      where: { sessionId: id, idx: { gte: base, lt: base + IDX_STRIDE } },
    }),
    ...(rows.length > 0 ? [prisma.transcriptSegment.createMany({ data: rows })] : []),
    ...(session.status === "RECORDING"
      ? [prisma.session.update({ where: { id }, data: { status: "TRANSCRIBING" } })]
      : []),
  ]);

  return NextResponse.json({ ok: true, segments: rows.length });
}
