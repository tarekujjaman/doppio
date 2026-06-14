import { devices, expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// WebKit (mobile Safari engine) rejects the chromium-only mic permission/flags.
test.use({ ...devices["iPhone 13"], permissions: [], launchOptions: {} });

const EMAIL = "e2e-mobile@doppio.test";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(page: import("@playwright/test").Page) {
  const a = admin();
  await a.auth.admin.createUser({ email: EMAIL, email_confirm: true }).catch(() => {});
  const { data } = await a.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  await page.goto(`/auth/confirm?token_hash=${data!.properties.hashed_token}&type=magiclink`);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Mobile diagnostic: a Bangla text-import session should show its transcript and
 *  (English) summary on a phone viewport with no console/page errors. */
test("mobile: session transcript + summary render without errors", async ({ page }) => {
  test.setTimeout(120_000);

  const errors: string[] = [];
  // Ignore dev-only HMR/Fast-Refresh noise (absent in production builds).
  const isDevNoise = (s: string) =>
    /hot-update|_next\/static\/webpack|Fast Refresh|access control checks/i.test(s);
  page.on("console", (m) => {
    if (m.type() === "error" && !isDevNoise(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!isDevNoise(e.message)) errors.push(`pageerror: ${e.message}`);
  });

  await signIn(page);

  // Create a READY Bangla session via text import (no recording needed).
  const res = await page.request.post("/api/sessions/import-text", {
    data: {
      title: "Mobile check — নিউটনের লেকচার",
      text: "আজকে আমরা ক্লাসে নিউটনের গতিসূত্র নিয়ে আলোচনা করব। আগামী সপ্তাহে এই অধ্যায়ের উপর পরীক্ষা হবে।",
    },
  });
  expect(res.status()).toBe(201);
  const { sessionId } = (await res.json()) as { sessionId: string };

  // Wait READY (background summarize).
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const poll = await page.request.get(`/api/sessions/${sessionId}`);
    if (poll.ok() && (await poll.json()).session.status === "READY") break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Dev-server RSC prefetch can interrupt a hard goto; retry until it sticks.
  const target = `/sessions/${sessionId}`;
  for (let i = 0; i < 6 && !page.url().includes(target); i++) {
    await page.goto(target, { waitUntil: "domcontentloaded" }).catch(() => {});
    if (!page.url().includes(target)) await page.waitForTimeout(750);
  }
  await expect(page.getByTestId("session-title")).toBeVisible();

  // Transcript (Bangla) is visible.
  await expect(page.getByTestId("transcript-segment").first()).toContainText("নিউটনের", {
    timeout: 15_000,
  });

  // Summary tab (default) shows an English summary.
  await expect(page.getByTestId("summary-overview")).toBeVisible();
  const overview = await page.getByTestId("summary-overview").textContent();
  expect(overview).toMatch(/[A-Za-z]/);

  // The portal must not scroll horizontally on a phone (the header nav used to
  // overflow because its flex wrapper lacked min-w-0).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(2);

  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
