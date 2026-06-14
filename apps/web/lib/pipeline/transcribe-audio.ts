import type { SttProvider, SttResult } from "@doppio/stt";
import { type NormalizedAudio, splitWav, WAV_BYTES_PER_SEC } from "@/lib/pipeline/transcode";

const CHUNK_SEC = 300; // 5-min chunks
const CHUNK_THRESHOLD_SEC = 600; // only chunk recordings longer than ~10 min
const CONCURRENCY = 3; // parallel TwinMind calls (keeps long audio inside the budget)

/**
 * Transcribes audio, chunking long WAVs so each STT call stays small and the
 * whole job fits the serverless window. Short/non-WAV audio goes in one call.
 * Chunks are transcribed in parallel and stitched with offset timestamps.
 */
export async function transcribeAudio(
  stt: SttProvider,
  audio: NormalizedAudio,
  fallbackDurationSec: number,
): Promise<SttResult> {
  const estSec =
    audio.contentType === "audio/wav"
      ? Math.round(audio.data.length / WAV_BYTES_PER_SEC)
      : fallbackDurationSec;

  if (audio.contentType !== "audio/wav" || estSec <= CHUNK_THRESHOLD_SEC) {
    return stt.transcribeFile({ audio, languageHint: "auto" });
  }

  const chunks = await splitWav(audio.data, CHUNK_SEC);
  if (chunks.length <= 1) {
    return stt.transcribeFile({ audio, languageHint: "auto" });
  }

  const results: SttResult[] = new Array(chunks.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < chunks.length) {
      const idx = next++;
      results[idx] = await stt.transcribeFile({
        audio: { data: chunks[idx]!, filename: `chunk_${idx}.wav`, contentType: "audio/wav" },
        languageHint: "auto",
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));

  const segments: SttResult["segments"] = [];
  let language = "unknown";
  results.forEach((r, idx) => {
    if (idx === 0 && r?.language) language = r.language;
    const offsetMs = idx * CHUNK_SEC * 1000;
    for (const s of r?.segments ?? []) {
      segments.push({
        startMs: s.startMs + offsetMs,
        endMs: s.endMs + offsetMs,
        text: s.text,
        speaker: s.speaker,
      });
    }
  });
  return { language, segments };
}