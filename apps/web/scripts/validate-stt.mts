/**
 * Real-STT validation: generate speech with OpenAI TTS, then transcribe it
 * back through each real adapter and report accuracy + latency.
 * Run: tsx --env-file=.env.local scripts/validate-stt.mts
 */
import { writeFileSync } from "node:fs";
import { OpenAiSttProvider } from "../../../packages/stt/src/openai";
import { TwinMindSttProvider } from "../../../packages/stt/src/twinmind";

const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const TWINMIND_KEY = process.env.TWINMIND_API_KEY!;

const CLIPS = [
  { name: "english", text: "Welcome to today's product meeting. We will discuss the launch timeline and the budget for next quarter." },
  { name: "codeswitch", text: "আজকের meeting এ আমরা project এর timeline এবং budget নিয়ে আলোচনা করব।" },
];

async function tts(text: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

async function main() {
  const whisper = new OpenAiSttProvider({ apiKey: OPENAI_KEY, model: "whisper-1" });
  const twinmind = new TwinMindSttProvider({ apiKey: TWINMIND_KEY, pollIntervalMs: 3000, maxWaitMs: 120_000 });

  for (const clip of CLIPS) {
    console.log(`\n${"=".repeat(70)}\nCLIP: ${clip.name}\nSAID: ${clip.text}\n`);
    const audio = await tts(clip.text);
    writeFileSync(`test-${clip.name}.mp3`, audio);
    console.log(`(generated ${audio.length} bytes)\n`);
    const input = { audio: { data: audio, filename: `test-${clip.name}.mp3`, contentType: "audio/mpeg" }, languageHint: "auto" as const };

    try {
      const { result, ms } = await timed(() => whisper.transcribeFile(input));
      console.log(`WHISPER  (${ms}ms, lang=${result.language}, ${result.segments.length} segs):`);
      console.log(`  ${result.segments.map((s) => s.text).join(" ")}`);
    } catch (err) {
      console.log(`WHISPER  FAILED: ${err instanceof Error ? err.message : err}`);
    }

    try {
      const { result, ms } = await timed(() => twinmind.transcribeFile(input));
      console.log(`TWINMIND (${ms}ms, lang=${result.language}, ${result.segments.length} segs):`);
      console.log(`  ${result.segments.map((s) => s.text).join(" ")}`);
    } catch (err) {
      console.log(`TWINMIND FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
