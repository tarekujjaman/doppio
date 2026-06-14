import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

const exec = promisify(execFile);

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