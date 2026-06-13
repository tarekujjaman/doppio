import { detectLanguage } from "@doppio/core";
import type { SttInput, SttProvider, SttResult, SttSegment } from "./types";

/** Thrown on a 415 so a caller can fall back to another provider (e.g. webm → Whisper). */
export class SttFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SttFormatError";
  }
}

interface TwinMindSegment {
  text?: string;
  speaker?: string;
  start_seconds?: number;
  end_seconds?: number;
}

// api.twinmind.dev formats (per ASR docs). webm/mp4 are NOT accepted.
const SUPPORTED_EXT = new Set(["mp3", "m4a", "wav", "flac", "ogg", "aac"]);

/**
 * TwinMind Ear-3 ASR adapter (primary STT). Synchronous /v1/transcribe endpoint
 * — best for files under ~5 min and well within the serverless budget (18×
 * real-time). Native multilingual + Bangla–English code-switch + diarization.
 * Docs: TwinMind-ASR-Documentation.pdf.
 */
export class TwinMindSttProvider implements SttProvider {
  readonly name = "twinmind";

  constructor(
    private readonly opts: {
      apiKey: string;
      apiBase?: string;
      model?: string;
    },
  ) {}

  private get base() {
    return (this.opts.apiBase ?? "https://api.twinmind.dev/v1").replace(/\/$/, "");
  }

  supports(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return SUPPORTED_EXT.has(ext);
  }

  async transcribeFile(input: SttInput): Promise<SttResult> {
    if (!this.supports(input.audio.filename)) {
      throw new SttFormatError(`TwinMind does not accept "${input.audio.filename}"`);
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([input.audio.data as BlobPart], { type: input.audio.contentType }),
      input.audio.filename,
    );
    form.append("model", this.opts.model ?? "ear-3-pro");
    // language defaults to auto-detect (Ear-3 covers 140+ langs incl. Bangla);
    // the docs only allow a small fixed set as an explicit override, so we let
    // it auto-detect rather than risk an unsupported-language rejection.

    const res = await fetch(`${this.base}/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.apiKey}` },
      body: form,
    });

    if (res.status === 415) {
      throw new SttFormatError(`TwinMind rejected the audio format (415)`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TwinMind transcribe failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      transcription?: Record<string, TwinMindSegment | unknown>;
    };
    return this.parse(data.transcription ?? {});
  }

  /** transcription is an object keyed "0","1",… plus a "metadata" entry. */
  private parse(transcription: Record<string, unknown>): SttResult {
    const segments: SttSegment[] = [];
    for (const [key, value] of Object.entries(transcription)) {
      if (key === "metadata" || !value || typeof value !== "object") continue;
      const seg = value as TwinMindSegment;
      const text = String(seg.text ?? "").trim();
      if (!text) continue;
      segments.push({
        startMs: Math.round((seg.start_seconds ?? 0) * 1000),
        endMs: Math.round((seg.end_seconds ?? seg.start_seconds ?? 0) * 1000),
        text,
        speaker: seg.speaker ? String(seg.speaker) : undefined,
      });
    }
    segments.sort((a, b) => a.startMs - b.startMs);

    // The result carries no detected-language field, so infer from script.
    const joined = segments.map((s) => s.text).join(" ");
    return { language: detectLanguage(joined), segments };
  }
}
