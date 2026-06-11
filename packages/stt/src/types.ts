/** STT provider abstraction (INIT-10/11 seam) — all app code depends only on this. */
export interface SttSegment {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string; // TwinMind diarization bonus (V1-14 seam)
}

export interface SttResult {
  language: string; // detected: "bn" | "en" | "mixed" | ...
  segments: SttSegment[];
}

export interface SttInput {
  /** Raw audio bytes (downloaded server-side from Supabase Storage). */
  audio: { data: Uint8Array; filename: string; contentType: string };
  languageHint?: "bn" | "en" | "auto";
}

export interface SttProvider {
  readonly name: string;
  /** Batch transcription. TwinMind adapter block-polls its async job internally. */
  transcribeFile(input: SttInput): Promise<SttResult>;
}

export type SttProviderName = "mock" | "twinmind" | "openai";
