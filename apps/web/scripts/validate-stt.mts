/**
 * Real-STT validation: generate speech with OpenAI TTS, then transcribe it
 * back through TwinMind (Ear-3) and Whisper. Reports accuracy + latency + script.
 * Run: tsx --env-file=.env.local scripts/validate-stt.mts
 */
import { OpenAiSttProvider } from "../../../packages/stt/src/openai";
import { TwinMindSttProvider } from "../../../packages/stt/src/twinmind";

const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const TWINMIND_KEY = process.env.TWINMIND_API_KEY!;

const CLIPS = [
  { name: "english", text: "Welcome to today's product meeting. We will discuss the launch timeline and the budget for next quarter." },
  { name: "codeswitch", text: "আজকের meeting এ আমরা project এর timeline এবং budget নিয়ে আলোচনা করব। নতুন feature টা আগামী সপ্তাহে release হবে।" },
];

async function tts(text: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

const script = (s: string) => (/[ऀ-ॿ]/.test(s) ? "DEVANAGARI✗" : /[ঀ-৿]/.test(s) ? "bengali✓" : "latin");

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  try { return { result: await fn(), ms: Date.now() - t0 }; }
  catch (err) { return { error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 }; }
}

async function main() {
  // Quick balance check confirms auth + the right base URL.
  const bal = await fetch("https://api.twinmind.dev/v1/usage/balance", {
    headers: { Authorization: `Bearer ${TWINMIND_KEY}` },
  });
  console.log(`TwinMind balance check: ${bal.status} ${(await bal.text()).slice(0, 120)}\n`);

  const twinmind = new TwinMindSttProvider({ apiKey: TWINMIND_KEY, model: "ear-3-pro" });
  const whisper = new OpenAiSttProvider({ apiKey: OPENAI_KEY, model: "whisper-1" });

  for (const clip of CLIPS) {
    console.log(`${"=".repeat(72)}\nCLIP: ${clip.name}\nSAID: ${clip.text}\n`);
    const audio = await tts(clip.text);
    const input = { audio: { data: audio, filename: `c-${clip.name}.mp3`, contentType: "audio/mpeg" }, languageHint: "auto" as const };

    const tm = await timed(() => twinmind.transcribeFile(input));
    if ("result" in tm) {
      const t = tm.result.segments.map((s) => `${s.speaker ? `[${s.speaker}] ` : ""}${s.text}`).join(" ");
      console.log(`TWINMIND (${tm.ms}ms, lang=${tm.result.language}, ${tm.result.segments.length} segs, ${script(t)}):\n  ${t}\n`);
    } else {
      console.log(`TWINMIND FAILED (${tm.ms}ms): ${tm.error}\n`);
    }

    const w = await timed(() => whisper.transcribeFile(input));
    if ("result" in w) {
      const t = w.result.segments.map((s) => s.text).join(" ");
      console.log(`WHISPER  (${w.ms}ms, lang=${w.result.language}, ${script(t)}):\n  ${t}\n`);
    } else {
      console.log(`WHISPER FAILED: ${w.error}\n`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
