/** Find the Whisper config that yields correct Bengali script for Bangla audio
 *  without breaking English. Run: tsx --env-file=.env.local scripts/experiment-whisper.mts */
const KEY = process.env.OPENAI_API_KEY!;
const BENGALI_PROMPT = "এটি একটি বাংলা মিটিং। নিচে বাংলায় প্রতিলিপি দেওয়া হলো।";

const CLIPS = [
  { name: "bangla-codeswitch", text: "আজকের meeting এ আমরা নতুন product launch নিয়ে কথা বলব।" },
  { name: "english", text: "Let's review the launch plan and the budget for next quarter." },
];

async function tts(text: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
  });
  return new Uint8Array(await res.arrayBuffer());
}

async function whisper(audio: Uint8Array, opts: { language?: string; prompt?: string }): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio as BlobPart], { type: "audio/mpeg" }), "c.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "json");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) return `ERROR ${res.status}: ${(await res.text()).slice(0, 120)}`;
  return ((await res.json()) as { text: string }).text.trim();
}

const isBengali = (s: string) => /[ঀ-৿]/.test(s);
const isDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);
const tag = (s: string) => (isDevanagari(s) ? "DEVANAGARI✗" : isBengali(s) ? "bengali✓" : "latin");

async function main() {
  for (const clip of CLIPS) {
    console.log(`\n${"=".repeat(70)}\n${clip.name}: ${clip.text}\n`);
    const audio = await tts(clip.text);
    const configs = [
      { label: "auto", opts: {} },
      { label: "lang=bn", opts: { language: "bn" } },
      { label: "auto+bnPrompt", opts: { prompt: BENGALI_PROMPT } },
      { label: "lang=bn+bnPrompt", opts: { language: "bn", prompt: BENGALI_PROMPT } },
    ];
    for (const c of configs) {
      const out = await whisper(audio, c.opts);
      console.log(`  [${c.label.padEnd(18)}] ${tag(out).padEnd(12)} ${out}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
