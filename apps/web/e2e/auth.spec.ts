import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Unique per spec file: parallel workers generating links for the same user
// invalidate each other's tokens.
const E2E_EMAIL = "e2e-auth@doppio.test";

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

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Doppio")).toBeVisible();
  await expect(page.getByRole("button", { name: /Send sign-in link/ })).toBeVisible();
});
