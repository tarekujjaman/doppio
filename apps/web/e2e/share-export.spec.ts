import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const E2E_EMAIL = "e2e-share@doppio.test";

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

async function createReadySession(page: import("@playwright/test").Page): Promise<string> {
  const res = await page.request.post("/api/sessions/import-text", {
    data: {
      title: "Share fixture — নিউটনের লেকচার",
      text: "আজকে আমরা ক্লাসে নিউটনের গতিসূত্র নিয়ে আলোচনা করব। প্রথম সূত্র বলে বাহ্যিক বল ছাড়া স্থির বস্তু স্থির থাকে।",
    },
  });
  expect(res.status()).toBe(201);
  const { sessionId } = (await res.json()) as { sessionId: string };

  // import-text summarizes in the background — wait for READY.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const poll = await page.request.get(`/api/sessions/${sessionId}`);
    if (poll.ok()) {
      const { session } = (await poll.json()) as { session: { status: string } };
      if (session.status === "READY") return sessionId;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("import-text session never became READY");
}

/** M7 DoD: share link opens logged-out, revoked link 404s, exports render. */
test("share link → public view (logged out) → revoke → 404", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const sessionId = await createReadySession(page);

  // Create a full-scope link via the API the UI uses.
  const created = await page.request.post(`/api/sessions/${sessionId}/share`, {
    data: { scope: "full", expiresInDays: 7 },
  });
  expect(created.status()).toBe(201);
  const { link } = (await created.json()) as { link: { id: string; token: string } };

  // Open it in a fresh, unauthenticated browser context.
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`/share/${link.token}`);
  await expect(anonPage.getByTestId("share-summary")).toBeVisible();
  await expect(anonPage.getByTestId("share-segment").first()).toContainText("নিউটনের");
  // Never indexed.
  await expect(anonPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // Revoke → public page is gone.
  const revoked = await page.request.delete(`/api/share-links/${link.id}`);
  expect(revoked.ok()).toBeTruthy();
  const after = await anonPage.request.get(`/share/${link.token}`);
  expect(after.status()).toBe(404);
  await anonContext.close();
});

test("share panel UI creates and lists links", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const sessionId = await createReadySession(page);

  await page.goto(`/sessions/${sessionId}`);
  await page.getByTestId("share-button").click();
  await page.getByTestId("create-share-link").click();
  await expect(page.getByTestId("share-link-row").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("share-link-row").first()).toContainText("/share/");
});

test("PDF and DOCX exports download with embedded Bangla", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const sessionId = await createReadySession(page);

  const pdf = await page.request.get(`/api/sessions/${sessionId}/export?format=pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  const pdfBody = await pdf.body();
  expect(pdfBody.subarray(0, 5).toString()).toBe("%PDF-");
  // Chromium embeds subset webfonts — a real render is far bigger than an empty page.
  expect(pdfBody.length).toBeGreaterThan(20_000);

  const docx = await page.request.get(`/api/sessions/${sessionId}/export?format=docx`);
  expect(docx.status()).toBe(200);
  expect(docx.headers()["content-type"]).toContain("officedocument");
  const docxBody = await docx.body();
  expect(docxBody.subarray(0, 2).toString()).toBe("PK"); // zip container

  // Ownership enforced: another user's export 404s (cross-user denial).
  const admin = adminClient();
  await admin.auth.admin
    .createUser({ email: "e2e-share-other@doppio.test", email_confirm: true })
    .catch(() => {/* exists */});
  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "e2e-share-other@doppio.test",
  });
  await page.goto(`/auth/confirm?token_hash=${data!.properties.hashed_token}&type=magiclink`);
  const denied = await page.request.get(`/api/sessions/${sessionId}/export?format=pdf`);
  expect(denied.status()).toBe(404);
});
