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

// A Bengali context prompt nudges Whisper to emit Bengali script. whisper-1
// rejects language="bn", and auto-detect intermittently renders Bangla speech
// in Devanagari (Hindi) script — so we coerce only when that happens.
const BENGALI_PROMPT = "এটি একটি বাংলা কথোপকথন। নিচে বাংলা ভাষায় প্রতিলিপি দেওয়া হলো।";
const DEVANAGARI = /[ऀ-ॿ]/;
const BENGALI = /[ঀ-৿]/;

function scriptCounts(text: string): { dev: number; ben: number } {
  let dev = 0;
  let ben = 0;
  for (const ch of text) {
    if (DEVANAGARI.test(ch)) dev++;
    else if (BENGALI.test(ch)) ben++;
  }
  return { dev, ben };
}

/**
 * OpenAI Whisper adapter (whisper-1 + verbose_json for segment timestamps,
 * which click-to-seek and Ask citations depend on). 25MB file limit.
 *
 * Bangla-first handling: whisper-1 can't be forced to language="bn", and
 * auto-detect sometimes transcribes Bangla audio into Devanagari. So we run a
 * second pass with a Bengali prompt ONLY when the first pass came back in
 * Devanagari — fixing the script without harming English (which never trips it).
 */
export class OpenAiSttProvider implements SttProvider {
  readonly name = "openai";

  constructor(
    private readonly opts: {
      apiKey: string;
      model?: string;
    },
  ) {}

  private async transcribe(input: SttInput, prompt?: string): Promise<SttResult> {
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
    if (prompt) form.append("prompt", prompt);

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
    if (segments.length === 0 && data.text) {
      segments.push({ startMs: 0, endMs: 0, text: data.text.trim() });
    }
    return { language: data.language ?? "unknown", segments };
  }

  async transcribeFile(input: SttInput): Promise<SttResult> {
    const first = await this.transcribe(input);

    // Bangla rendered as Devanagari → re-transcribe with a Bengali prompt.
    const joined = first.segments.map((s) => s.text).join(" ");
    const { dev, ben } = scriptCounts(joined);
    if (dev > 0 && dev >= ben) {
      try {
        const second = await this.transcribe(input, BENGALI_PROMPT);
        const secondJoined = second.segments.map((s) => s.text).join(" ");
        const counts = scriptCounts(secondJoined);
        // Accept the retry only if it actually improved the script.
        if (counts.ben > counts.dev) return { ...second, language: "bn" };
      } catch {
        // fall through to the first-pass result
      }
    }

    return first;
  }
}
