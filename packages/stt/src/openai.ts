import type { SttInput, SttProvider, SttResult } from "./types";

interface WhisperVerboseSegment {
  start: number; // seconds
  end: number;
  text: string;
}

interface WhisperVerboseResponse {
  language?: string;
  segments?: WhisperVerboseSegment[];
  text?: string;
}

/**
 * OpenAI fallback adapter. Uses whisper-1 + verbose_json because the
 * gpt-4o-*-transcribe models do not return segment timestamps, which
 * click-to-seek and Ask citations depend on. 25MB file limit.
 */
export class OpenAiSttProvider implements SttProvider {
  readonly name = "openai";

  constructor(
    private readonly opts: {
      apiKey: string;
      model?: string;
    },
  ) {}

  async transcribeFile(input: SttInput): Promise<SttResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([input.audio.data as BlobPart], { type: input.audio.contentType }),
      input.audio.filename,
    );
    form.append("model", this.opts.model ?? "whisper-1");
    form.append("response_format", "verbose_json");
    if (input.languageHint && input.languageHint !== "auto") {
      form.append("language", input.languageHint);
    }

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI STT failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as WhisperVerboseResponse;
    const segments = (data.segments ?? []).map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
    }));

    // Whisper rarely returns zero segments with non-empty text; cover it anyway.
    if (segments.length === 0 && data.text) {
      segments.push({ startMs: 0, endMs: 0, text: data.text.trim() });
    }

    return { language: data.language ?? "unknown", segments };
  }
}
