import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Dedicated user — this spec deletes the account at the end.
const E2E_EMAIL = "e2e-settings@doppio.test";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function signIn(page: import("@playwright/test").Page) {
  const admin = adminClient();
  // Deterministic start state: a failed previous run may have left the user
  // with settings already applied — recreate from scratch.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === E2E_EMAIL);
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  await admin.auth.admin.createUser({ email: E2E_EMAIL, email_confirm: true });
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: E2E_EMAIL });
  await page.goto(`/auth/confirm?token_hash=${data!.properties.hashed_token}&type=magiclink`);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** MVP-33: profile + privacy persist, data export works, deletion is total. */
test("settings: profile, private mode, data export, account deletion", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);

  // Give the account some data so deletion is meaningful.
  await page.request.post("/api/sessions/import-text", {
    data: { title: "Settings fixture", text: "Some content to be deleted with the account." },
  });

  await page.goto("/settings");
  await page.locator('[data-testid="settings-root"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });

  // Profile name persists (wait for the PATCH before reloading).
  await page.getByTestId("name-input").fill("E2E Tester");
  const namePatched = page.waitForResponse(
    (r) => r.url().endsWith("/api/me") && r.request().method() === "PATCH",
    { timeout: 30_000 },
  );
  await page.getByTestId("save-name").click();
  expect((await namePatched).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("name-input")).toHaveValue("E2E Tester", { timeout: 15_000 });

  // Private-mode default persists.
  const toggle = page.getByTestId("private-mode-toggle");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  const modePatched = page.waitForResponse(
    (r) => r.url().endsWith("/api/me") && r.request().method() === "PATCH",
    { timeout: 30_000 },
  );
  await toggle.click();
  expect((await modePatched).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("private-mode-toggle")).toHaveAttribute("aria-checked", "true", {
    timeout: 15_000,
  });

  // Data export contains the profile.
  const dump = await page.request.get("/api/me/export");
  expect(dump.status()).toBe(200);
  const body = (await dump.json()) as { profile: { email: string }; sessions: unknown[] };
  expect(body.profile.email).toBe(E2E_EMAIL);
  expect(body.sessions.length).toBeGreaterThan(0);

  // Account deletion: prompt-confirmed, signs out, identity gone.
  page.once("dialog", (d) => void d.accept("DELETE"));
  await page.getByTestId("delete-account").click();
  await expect(page).toHaveURL(/\/$|\/login/, { timeout: 30_000 });

  const me = await page.request.get("/api/me");
  expect(me.status()).toBe(401);

  // Identity removed from Supabase auth.
  const admin = adminClient();
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(list?.users.find((u) => u.email === E2E_EMAIL)).toBeUndefined();
});
