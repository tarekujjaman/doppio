import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

const exec = promisify(execFile);

/** 16 kHz mono 16-bit PCM → bytes per second (used to estimate WAV duration). */
export const WAV_BYTES_PER_SEC = 16_000 * 2;

// Formats the primary STT (TwinMind) accepts directly — see packages/stt/twinmind.ts.
const TWINMIND_OK = new Set(["mp3", "m4a", "wav", "flac", "ogg", "aac"]);

const CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  aac: "audio/aac",
};

export interface NormalizedAudio {
  data: Uint8Array;
  filename: string;
  contentType: string;
}

/**
 * Ensures audio is in a TwinMind-accepted format so the PRIMARY STT always
 * handles it (no silent Whisper fallback). MediaRecorder webm/opus (extension)
 * and mp4 uploads are transcoded to 16 kHz mono WAV via the bundled ffmpeg.
 * Accepted formats pass through untouched.
 */
export async function ensureTwinMindFormat(
  data: Uint8Array,
  filename: string,
): Promise<NormalizedAudio> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (TWINMIND_OK.has(ext)) {
    return { data, filename, contentType: CONTENT_TYPE[ext] ?? "application/octet-stream" };
  }
  if (!ffmpegStatic) throw new Error("ffmpeg-static binary unavailable — cannot transcode audio");

  const dir = await mkdtemp(join(tmpdir(), "doppio-tc-"));
  const inPath = join(dir, `in.${ext || "bin"}`);
  const outPath = join(dir, "out.wav");
  try {
    await writeFile(inPath, data);
    await exec(
      ffmpegStatic,
      ["-y", "-nostdin", "-loglevel", "error", "-i", inPath, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outPath],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const wav = await readFile(outPath);
    return {
      data: new Uint8Array(wav),
      filename: filename.replace(/\.[^./]+$/, "") + ".wav",
      contentType: "audio/wav",
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Splits a WAV into ~segmentSec-long pieces (re-encoded so each piece is a valid
 * standalone WAV). Returns chunk bytes in playback order — used to keep each STT
 * call inside the serverless budget for long recordings.
 */
export async function splitWav(data: Uint8Array, segmentSec: number): Promise<Uint8Array[]> {
  if (!ffmpegStatic) throw new Error("ffmpeg-static binary unavailable — cannot split audio");
  const dir = await mkdtemp(join(tmpdir(), "doppio-split-"));
  const inPath = join(dir, "in.wav");
  try {
    await writeFile(inPath, data);
    await exec(
      ffmpegStatic,
      [
        "-y", "-nostdin", "-loglevel", "error", "-i", inPath,
        "-f", "segment", "-segment_time", String(segmentSec),
        "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        join(dir, "chunk_%03d.wav"),
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const names = (await readdir(dir))
      .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
      .sort();
    const chunks = await Promise.all(names.map((n) => readFile(join(dir, n))));
    return chunks.map((b) => new Uint8Array(b));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}