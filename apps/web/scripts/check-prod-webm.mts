/** Verify the extension's exact path on PROD: record a real webm, upload via
 * upload-url (Bearer) → Supabase signed PUT → ingest → poll until READY.
 * Run: tsx --env-file=.env.local scripts/check-prod-webm.mts */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const PROD = "https://doppio-gamma.vercel.app";
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = "ext-check@doppio.test";
const PASSWORD = "ext-pass-12345";

async function recordWebm(): Promise<Uint8Array> {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const page = await browser.newPage();
  await page.goto("about:blank");
  const b64 = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 200;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start(1000);
    await new Promise((r) => setTimeout(r, 4000));
    await new Promise<void>((r) => { rec.onstop = () => r(); rec.stop(); });
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let s = ""; for (const b of buf) s += String.fromCharCode(b);
    return btoa(s);
  });
  await browser.close();
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function main() {
  const audio = await recordWebm();
  console.log(`webm bytes: ${audio.length}`);

  const sb = createClient(SB, ANON, { auth: { persistSession: false } });
  await sb.auth.admin; // noop
  const { data: signIn, error: sErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (sErr) throw new Error(`sign-in: ${sErr.message}`);
  const token = signIn.session!.access_token;

  // upload-url
  const urlRes = await fetch(`${PROD}/api/sessions/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: "tab-recording-test.webm", contentType: "audio/webm", sizeBytes: audio.length, durationSec: 4, source: "EXTENSION", title: "PROD webm check" }),
  });
  if (!urlRes.ok) throw new Error(`upload-url ${urlRes.status}: ${await urlRes.text()}`);
  const { sessionId, path, token: upToken } = await urlRes.json();
  console.log(`session: ${sessionId}`);

  // signed PUT
  const up = await sb.storage.from("doppio-audio").uploadToSignedUrl(path, upToken, new Blob([audio], { type: "audio/webm" }));
  if (up.error) throw new Error(`storage: ${up.error.message}`);

  // ingest
  const ing = await fetch(`${PROD}/api/sessions/${sessionId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ durationSec: 4 }),
  });
  if (!ing.ok) throw new Error(`ingest ${ing.status}: ${await ing.text()}`);
  console.log("ingest accepted, polling…");

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const poll = await fetch(`${PROD}/api/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) continue;
    const { session } = await poll.json();
    if (session.status === "READY" || session.status === "FAILED") {
      console.log(`FINAL: ${session.status} | segs=${session.transcript?.length ?? 0} | hasAudio=${Boolean(session.audioKey)}`);
      process.exit(session.status === "READY" ? 0 : 1);
    }
  }
  console.log("timed out");
  process.exit(1);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
