import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "riad.celloscope@gmail.com"; // isAdminEmail default
const USER_EMAIL = "e2e-nonadmin@doppio.test";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  const a = admin();
  await a.auth.admin.createUser({ email, email_confirm: true }).catch(() => {});
  const { data } = await a.auth.admin.generateLink({ type: "magiclink", email });
  await page.goto(`/auth/confirm?token_hash=${data!.properties.hashed_token}&type=magiclink`);
  await expect(page).toHaveURL(/\/dashboard/);
}

test("admin email sees the Admin panel", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Recent sessions (all users)")).toBeVisible();
});

test("non-admin cannot reach /admin and has no Admin link", async ({ page }) => {
  await signIn(page, USER_EMAIL);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  // Guarded by notFound() — the route must 404 for non-admins.
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});
