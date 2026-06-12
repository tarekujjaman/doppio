import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Unique per spec file: parallel workers generating links for the same user
// invalidate each other's tokens.
const E2E_EMAIL = "e2e-auth@doppio.test";
const E2E_PW_EMAIL = "e2e-password@doppio.test";
const E2E_PASSWORD = "doppio-e2e-pass-123";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * M1 DoD: sign in (admin-generated magic link stands in for the email inbox)
 * → dashboard → refresh keeps session → sign out.
 */
test("email sign-in → dashboard → session persists → sign out", async ({ page }) => {
  const admin = adminClient();

  await admin.auth.admin
    .createUser({ email: E2E_EMAIL, email_confirm: true })
    .catch(() => {/* already exists */});

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: E2E_EMAIL,
  });
  expect(error).toBeNull();
  const tokenHash = data!.properties.hashed_token;

  await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=magiclink`);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(E2E_EMAIL)).toBeVisible();

  await page.reload();
  await expect(page.getByText(E2E_EMAIL)).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

/** Password auth: create account → dashboard → sign out → sign back in. */
test("password sign-up → dashboard → sign out → password sign-in", async ({ page }) => {
  // Idempotency: remove the password user from previous runs.
  const admin = adminClient();
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === E2E_PW_EMAIL);
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  // Submits credentials, retrying transient network blips (dev-env flake).
  async function submitCredentials(expectDashboard = true) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByTestId("email-input").fill(E2E_PW_EMAIL);
      await page.getByTestId("password-input").fill(E2E_PASSWORD);
      await page.getByTestId("auth-submit").click();
      const outcome = await Promise.race([
        page.waitForURL(/\/dashboard/, { timeout: 20_000 }).then(() => "ok" as const),
        page
          .getByTestId("auth-error")
          .waitFor({ timeout: 20_000 })
          .then(() => "error" as const),
      ]).catch(() => "timeout" as const);
      if (outcome === "ok") return;
      const message = (await page.getByTestId("auth-error").textContent().catch(() => "")) ?? "";
      if (!/failed to fetch|network/i.test(message)) {
        throw new Error(`auth failed: ${message || outcome}`);
      }
      // transient — retry
    }
    if (expectDashboard) await expect(page).toHaveURL(/\/dashboard/);
  }

  // Sign up via the UI (wait for hydration before interacting; settle dev compiles).
  await page.goto("/login");
  await page.locator('[data-testid="auth-submit"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle");
  await page.getByTestId("goto-signup").click();
  await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  await submitCredentials();
  await expect(page.getByText(E2E_PW_EMAIL)).toBeVisible();

  // Sign out.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  // Sign back in with the password.
  await page.locator('[data-testid="auth-submit"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await submitCredentials();

  // Wrong password shows a friendly, actionable error.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.locator('[data-testid="auth-submit"][data-hydrated="true"]').waitFor({
    timeout: 60_000,
  });
  await page.getByTestId("email-input").fill(E2E_PW_EMAIL);
  await page.getByTestId("password-input").fill("wrong-password-1");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(/wrong email or password/i, {
    timeout: 20_000,
  });
});

test("login page renders password-first with magic-link fallback", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Doppio")).toBeVisible();
  await expect(page.getByTestId("auth-submit")).toBeVisible();
  await expect(page.getByText(/email me a sign-in link/i)).toBeVisible();
});
