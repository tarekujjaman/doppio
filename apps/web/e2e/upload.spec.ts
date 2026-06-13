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

/**
 * 20-second silent 16-bit mono PCM WAV (8kHz) — long enough that seeks to the
 * mock fixture's segment timestamps (0–17.5s) land instead of clamping.
 */
function silentWav(): Buffer {
  const sampleRate = 8000;
  const numSamples = sampleRate * 20;
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
test("upload → transcribe → summarize → READY (mock providers)", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  // Clean slate: this user persists in the real DB across runs.
  const existing = await page.request.get("/api/sessions");
  if (existing.ok()) {
    const { sessions } = (await existing.json()) as { sessions: { id: string }[] };
    for (const s of sessions) await page.request.delete(`/api/sessions/${s.id}`);
  }

  // Wait for the component's own hydration sentinel before interacting.
  await page.locator('[data-testid="upload-zone"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Choose file/ }).click();
  const chooser = await chooserPromise;

  // Capture the created sessionId (auto-titling renames the session later,
  // so title-based lookup would be unreliable).
  const uploadUrlResponse = page.waitForResponse(
    (r) => r.url().includes("/api/sessions/upload-url") && r.request().method() === "POST",
  );
  await chooser!.setFiles({
    name: "bangla-fixture.wav",
    mimeType: "audio/wav",
    buffer: silentWav(),
  });
  const { sessionId } = (await (await uploadUrlResponse).json()) as { sessionId: string };

  const status = page.getByTestId("upload-status");
  await expect(status).toHaveText(/Ready/, { timeout: 120_000 });

  const detail = await page.request.get(`/api/sessions/${sessionId}`);
  expect(detail.ok()).toBeTruthy();
  const { session } = (await detail.json()) as {
    session: {
      status: string;
      title: string;
      language: string | null;
      transcript: { text: string }[];
      summary: { overview: string; language: string } | null;
      tags: string[];
    };
  };
  expect(session.status).toBe("READY");
  expect(session.language).toBe("bn");
  expect(session.transcript.length).toBeGreaterThan(0);
  expect(session.transcript[0]!.text).toMatch(/[ঀ-৿]/);

  // M3: the AI layer produced a summary in the content's language (mock LLM
  // honours the MVP-27 contract: Bangla in → Bangla out), auto-title and tags.
  expect(session.summary).not.toBeNull();
  expect(session.summary!.language).toBe("bn");
  expect(session.summary!.overview).toMatch(/[ঀ-৿]/);
  expect(session.tags.length).toBeGreaterThan(0);
  expect(session.title).not.toBe("bangla-fixture.wav"); // auto-title applied (MVP-07)

  // Sessions list shows the processed row.
  await page.goto("/sessions");
  await expect(page.getByTestId("session-row").first()).toContainText("Ready");

  // ── M4 workspace journey: open → play → seek → note → toggle action → rename ──
  await page.goto(`/sessions/${sessionId}`);
  await expect(page.getByTestId("session-title")).toBeVisible();

  // Play (wavesurfer loads the signed-URL audio).
  const playButton = page.getByRole("button", { name: "Play" });
  await expect(playButton).toBeEnabled({ timeout: 30_000 });
  await playButton.click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  // Click a later transcript segment → player seeks → that segment becomes active.
  const segments = page.getByTestId("transcript-segment");
  await segments.nth(2).click();
  await expect(segments.nth(2)).toHaveClass(/bg-primary-50/);

  // Add a time-anchored note (wait for the POST so slow dev servers don't flake).
  await page.getByRole("button", { name: /^Notes/ }).click();
  await page.getByTestId("note-input").fill("Follow up on this point");
  const notePosted = page.waitForResponse(
    (r) => r.url().includes(`/api/sessions/${sessionId}/notes`) && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /Add note/ }).click();
  expect((await notePosted).ok()).toBeTruthy();
  await expect(page.getByTestId("note-row")).toContainText("Follow up on this point", {
    timeout: 15_000,
  });

  // Toggle an action item (mock LLM always extracts one).
  await page.getByRole("button", { name: /^Actions/ }).click();
  const toggle = page.getByTestId("action-toggle").first();
  await toggle.click();
  await expect(toggle.locator("svg")).toBeVisible(); // check mark appears

  // Rename the session (wait for the PATCH to land before checking the server).
  await page.getByTestId("rename-button").click();
  await page.getByTestId("title-input").fill("Renamed by e2e");
  const patchDone = page.waitForResponse(
    (r) => r.url().endsWith(`/api/sessions/${sessionId}`) && r.request().method() === "PATCH",
  );
  await page.getByTestId("title-input").press("Enter");
  expect((await patchDone).ok()).toBeTruthy();
  await expect(page.getByTestId("session-title")).toContainText("Renamed by e2e");

  // Rename persisted server-side.
  const renamed = await page.request.get(`/api/sessions/${sessionId}`);
  const renamedBody = (await renamed.json()) as { session: { title: string } };
  expect(renamedBody.session.title).toBe("Renamed by e2e");

  // ── M5: Ask Doppio — Bangla question → streamed Bangla answer with citations ──
  await page.getByRole("button", { name: "Ask" }).click();
  await page.getByTestId("ask-input").fill("এই সেশনে কী আলোচনা হয়েছে?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByTestId("ask-answer")).toContainText(/[ঀ-৿]/, { timeout: 30_000 });
  await expect(page.getByTestId("ask-citation").first()).toBeVisible({ timeout: 15_000 });
});

/** In-browser mic recording → same pipeline → READY (web slice of INIT-06/MVP-14). */
test("record in browser → stop → transcribe → READY", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  await page.locator('[data-testid="upload-zone"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });

  // Start recording (fake device feeds a synthetic tone).
  await page.getByTestId("record-button").click();
  await expect(page.getByTestId("record-timer")).toBeVisible({ timeout: 15_000 });

  // Capture ~3 seconds, verify the timer advances.
  await expect(page.getByTestId("record-timer")).not.toHaveText("0:00", { timeout: 10_000 });

  // Pause/resume exercises the elapsed-time bookkeeping.
  await page.getByRole("button", { name: /pause recording/i }).click();
  await expect(page.getByText(/paused — nothing is being captured/i)).toBeVisible();
  await page.getByRole("button", { name: /resume recording/i }).click();

  const uploadUrlResponse = page.waitForResponse(
    (r) => r.url().includes("/api/sessions/upload-url") && r.request().method() === "POST",
  );
  await page.getByTestId("record-stop").click();
  const { sessionId } = (await (await uploadUrlResponse).json()) as { sessionId: string };

  await expect(page.getByTestId("upload-status")).toHaveText(/Ready/, { timeout: 120_000 });

  const detail = await page.request.get(`/api/sessions/${sessionId}`);
  const { session } = (await detail.json()) as {
    session: { status: string; durationSec: number | null; transcript: { text: string }[] };
  };
  expect(session.status).toBe("READY");
  expect(session.durationSec).toBeGreaterThan(0);
  expect(session.transcript.length).toBeGreaterThan(0);
});

test("search finds Bangla and English content with highlights", async ({ page }) => {
  await signIn(page);

  // Self-contained fixtures via text import (no dependency on other tests).
  await page.request.post("/api/sessions/import-text", {
    data: {
      title: "English planning notes",
      text: "The quarterly roadmap meeting discussed analytics dashboards and onboarding.",
    },
  });
  await page.request.post("/api/sessions/import-text", {
    data: {
      title: "Bangla physics lecture",
      text: "আজকে আমরা ক্লাসে নিউটনের গতিসূত্র নিয়ে আলোচনা করব। আগামী সপ্তাহে পরীক্ষা হবে।",
    },
  });

  await page.goto(`/search?q=${encodeURIComponent("নিউটনের")}`);
  await expect(page.getByTestId("search-hit").first()).toBeVisible();
  await expect(page.getByTestId("search-hit").first()).toContainText("নিউটনের");

  await page.goto("/search?q=roadmap");
  await expect(page.getByTestId("search-hit").first()).toContainText(/roadmap/i);
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
