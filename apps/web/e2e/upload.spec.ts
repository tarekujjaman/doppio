import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Unique per spec file (see auth.spec.ts).
const E2E_EMAIL = "e2e-upload@doppio.test";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** 1-second silent 16-bit mono PCM WAV (8kHz) — enough for the duration probe. */
function silentWav(): Buffer {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1s
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

async function signIn(page: import("@playwright/test").Page) {
  const admin = adminClient();
  await admin.auth.admin
    .createUser({ email: E2E_EMAIL, email_confirm: true })
    .catch(() => {/* exists */});
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: E2E_EMAIL });
  await page.goto(`/auth/confirm?token_hash=${data!.properties.hashed_token}&type=magiclink`);
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * M2 DoD: with STT_PROVIDER=mock, uploading a fixture named "bangla-*.wav"
 * yields a READY session with Bangla segments; status is visible while it runs.
 */
test("upload → transcribe → READY with segments (mock STT)", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  // Hydration timing in dev is unpredictable — retry the click until React's
  // handler is attached and the file chooser actually opens.
  let chooser: import("@playwright/test").FileChooser | null = null;
  for (let i = 0; i < 10 && !chooser; i++) {
    const attempt = page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null);
    await page.getByRole("button", { name: /Choose file/ }).click();
    chooser = await attempt;
  }
  expect(chooser, "file chooser should open after hydration").toBeTruthy();
  await chooser!.setFiles({
    name: "bangla-fixture.wav",
    mimeType: "audio/wav",
    buffer: silentWav(),
  });

  const status = page.getByTestId("upload-status");
  await expect(status).toHaveText(/Ready/, { timeout: 120_000 });

  // Verify via API that the session is READY with Bangla transcript segments.
  const list = await page.request.get("/api/sessions");
  expect(list.ok()).toBeTruthy();
  const { sessions } = (await list.json()) as {
    sessions: { id: string; status: string; title: string; language: string | null }[];
  };
  const uploaded = sessions.find((s) => s.title === "bangla-fixture.wav");
  expect(uploaded).toBeTruthy();
  expect(uploaded!.status).toBe("READY");
  expect(uploaded!.language).toBe("bn");

  const detail = await page.request.get(`/api/sessions/${uploaded!.id}`);
  const { session } = (await detail.json()) as {
    session: { transcript: { text: string }[] };
  };
  expect(session.transcript.length).toBeGreaterThan(0);
  expect(session.transcript[0]!.text).toMatch(/[ঀ-৿]/);

  // Sessions list shows the row with READY chip.
  await page.goto("/sessions");
  await expect(page.getByTestId("session-row").first()).toContainText("bangla-fixture.wav");
});

test("cross-user access is denied", async ({ page, browser }) => {
  await signIn(page);
  const list = await page.request.get("/api/sessions");
  const { sessions } = (await list.json()) as { sessions: { id: string }[] };
  test.skip(sessions.length === 0, "needs at least one session");

  // Second, different user must get 404 for the first user's session.
  const admin = adminClient();
  const otherEmail = "e2e-other@doppio.test";
  await admin.auth.admin.createUser({ email: otherEmail, email_confirm: true }).catch(() => {});
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: otherEmail });

  const ctx = await browser.newContext();
  const otherPage = await ctx.newPage();
  await otherPage.goto(
    `http://localhost:3000/auth/confirm?token_hash=${data!.properties.hashed_token}&type=magiclink`,
  );
  const res = await otherPage.request.get(`/api/sessions/${sessions[0]!.id}`);
  expect(res.status()).toBe(404);
  await ctx.close();
});
