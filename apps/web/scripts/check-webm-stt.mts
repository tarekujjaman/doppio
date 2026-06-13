/** Reproduce the webm transcription path: record a real webm/opus clip in
 * headless Chromium (what the recorders produce), then run it through the
 * providers exactly as the pipeline does. Run: tsx --env-file=.env.local ... */
import { chromium } from "@playwright/test";
import { createSttProvider } from "../../../packages/stt/src/index";

async function recordWebm(): Promise<Uint8Array> {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const page = await browser.newPage();
  await page.goto("about:blank");
  const b64 = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 220;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start(1000);
    await new Promise((r) => setTimeout(r, 4000));
    await new Promise<void>((r) => {
      rec.onstop = () => r();
      rec.stop();
    });
    const blob = new Blob(chunks, { type: "audio/webm" });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const byte of buf) s += String.fromCharCode(byte);
    return btoa(s);
  });
  await browser.close();
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function main() {
  console.log("recording a real webm/opus clip in Chromium…");
  const audio = await recordWebm();
  console.log(`webm bytes: ${audio.length}`);

  // Exactly what the pipeline does: STT_PROVIDER=twinmind → fallback to Whisper for webm.
  const stt = createSttProvider({
    STT_PROVIDER: "twinmind",
    TWINMIND_API_KEY: process.env.TWINMIND_API_KEY,
    TWINMIND_API_BASE: "https://api.twinmind.dev/v1",
    TWINMIND_MODEL: "ear-3-pro",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    STT_MODEL: "whisper-1",
  });

  try {
    const res = await stt.transcribeFile({
      audio: { data: audio, filename: "recording-test.webm", contentType: "audio/webm" },
      languageHint: "auto",
    });
    console.log(`OK lang=${res.language} segs=${res.segments.length}`);
    console.log("text:", res.segments.map((s) => s.text).join(" ").slice(0, 200));
  } catch (err) {
    console.log("FAILED:", err instanceof Error ? err.message : err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
