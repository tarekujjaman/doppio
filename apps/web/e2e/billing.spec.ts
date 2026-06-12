import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Unique per spec file so usage/plan state never collides with other specs.
const E2E_EMAIL = "e2e-billing@doppio.test";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
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

function silentWavSmall(): Buffer {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1s is plenty here
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

/**
 * M6 DoD: blocked free user sees the upgrade prompt → sandbox payment →
 * PRO is active and uploads work. The quota *math* boundary is unit-tested in
 * @doppio/core; here the blocked branch is exercised by intercepting ingest
 * with the same 402 the server returns at the cap.
 */
test("quota block → upgrade prompt → sandbox pay → PRO active", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  // 1. Blocked upload → friendly upgrade prompt (intercept ingest with the real 402 shape).
  await page.route("**/api/sessions/*/ingest", (route) =>
    route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "QUOTA_EXCEEDED", message: "Transcription quota exceeded" },
      }),
    }),
  );

  await page.locator('[data-testid="upload-zone"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Choose file/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "clip.wav", mimeType: "audio/wav", buffer: silentWavSmall() });

  await expect(page.getByTestId("upload-status")).toContainText(/used all your transcription/i, {
    timeout: 60_000,
  });
  await expect(page.getByTestId("upgrade-prompt")).toBeVisible();
  await page.unroute("**/api/sessions/*/ingest");

  // 2. Upgrade → sandbox gateway → simulate success → webhook flips plan to PRO.
  // (The user may already be PRO from a previous run — the webhook is
  // renewal-safe, so the flow is identical; only the start state varies.)
  await page.getByTestId("upgrade-prompt").click();
  await expect(page).toHaveURL(/\/billing/);
  await expect(page.getByTestId("plan-name")).toBeVisible();

  const upgradeOrManage = page.locator('[data-testid="upgrade-button"][data-hydrated="true"]');
  if ((await page.getByTestId("plan-name").textContent()) === "Pro") {
    // Already PRO: exercise checkout directly via API → sandbox page.
    const checkout = await page.request.post("/api/billing/checkout", {
      data: { plan: "PRO" },
    });
    const { paymentUrl } = (await checkout.json()) as { paymentUrl: string };
    await page.goto(paymentUrl);
  } else {
    await upgradeOrManage.click();
  }
  await expect(page).toHaveURL(/\/billing\/sandbox\//, { timeout: 30_000 });
  await page.locator('[data-testid="simulate-success"][data-hydrated="true"]').click();

  await expect(page).toHaveURL(/\/billing\?paid=1/, { timeout: 30_000 });
  await expect(page.getByTestId("plan-name")).toHaveText("Pro", { timeout: 15_000 });
  await expect(page.getByText(/completed/).first()).toBeVisible();

  // 3. PRO user uploads successfully end-to-end (no interception).
  const billing = await page.request.get("/api/billing");
  const billingBody = (await billing.json()) as { plan: string };
  expect(billingBody.plan).toBe("PRO");

  await page.goto("/dashboard");
  await page.locator('[data-testid="upload-zone"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });
  const chooser2Promise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Choose file/ }).click();
  const chooser2 = await chooser2Promise;
  await chooser2.setFiles({ name: "clip2.wav", mimeType: "audio/wav", buffer: silentWavSmall() });
  await expect(page.getByTestId("upload-status")).toHaveText(/Ready/, { timeout: 120_000 });
});
