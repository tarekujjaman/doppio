/**
 * Production smoke test for REAL transcription: drives a real browser through
 * the live upload flow with a TTS-generated Bangla clip and asserts the
 * transcript reflects what was actually said (not the mock fixture).
 * Run: tsx --env-file=.env.local scripts/verify-prod.mts
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const PROD = "https://doppio-gamma.vercel.app";
const EMAIL = "prodcheck@doppio.test";
const SPOKEN = "আজকের meeting এ আমরা নতুন product launch নিয়ে কথা বলব।";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function tts(text: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log(`SPOKEN: ${SPOKEN}\n`);
  const audio = await tts(SPOKEN);

  await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true }).catch(() => {});
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const tokenHash = data!.properties!.hashed_token;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${PROD}/auth/confirm?token_hash=${tokenHash}&type=magiclink`, { waitUntil: "networkidle" });
  if (!/\/dashboard/.test(page.url())) throw new Error(`sign-in failed, at ${page.url()}`);

  await page.locator('[data-testid="upload-zone"][data-hydrated="true"]').waitFor({ timeout: 60_000 });
  const uploadUrlResp = page.waitForResponse(
    (r) => r.url().includes("/api/sessions/upload-url") && r.request().method() === "POST",
  );
  await page.locator('[data-testid="upload-input"]').setInputFiles({
    name: "prod-check.mp3",
    mimeType: "audio/mpeg",
    buffer: audio,
  });
  const { sessionId } = (await (await uploadUrlResp).json()) as { sessionId: string };
  console.log(`session: ${sessionId}\nprocessing (real Whisper)…`);

  await page.locator('[data-testid="upload-status"]').filter({ hasText: "Ready" }).waitFor({ timeout: 120_000 });

  const detail = await page.request.get(`${PROD}/api/sessions/${sessionId}`);
  const { session } = (await detail.json()) as {
    session: {
      status: string; language: string | null; durationSec: number | null;
      audioKey?: string | null; hasAudio?: boolean;
      transcript: { text: string }[]; summary: { overview: string } | null;
    };
  };
  const transcript = session.transcript.map((s) => s.text).join(" ");

  console.log(`\nstatus:     ${session.status}`);
  console.log(`language:   ${session.language}`);
  console.log(`hasAudio:   ${session.hasAudio} (expected false — audio discarded)`);
  console.log(`TRANSCRIPT: ${transcript}`);
  console.log(`SUMMARY:    ${session.summary?.overview ?? "(none)"}`);

  // Mock fixture talks about নিউটনের গতিসূত্র; real transcription must not, and
  // Bangla audio must land in Bengali script (not Devanagari).
  const isMock = transcript.includes("গতিসূত্র");
  const isBengali = /[ঀ-৿]/.test(transcript);
  const isDevanagari = /[ऀ-ॿ]/.test(transcript);
  const looksReal = !isMock && isBengali && !isDevanagari;
  console.log(`\nbengali script: ${isBengali} · devanagari: ${isDevanagari} · mock: ${isMock}`);
  console.log(`REAL transcription in correct script: ${looksReal ? "YES ✓" : "NO ✗"}`);

  await browser.close();
  process.exit(!isMock && looksReal ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
