import { buildExportHtml } from "./html";
import type { SessionExportData } from "./data";

/**
 * Finds Playwright's downloaded Chromium by scanning its cache directory —
 * importing playwright-core here would drag it into the webpack bundle.
 */
async function findPlaywrightChromium(): Promise<string | undefined> {
  const { existsSync, readdirSync } = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");

  const base =
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
        : path.join(os.homedir(), ".cache", "ms-playwright");
  if (!existsSync(base)) return undefined;

  const dirs = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const rel of ["chrome-win\\chrome.exe", "chrome-win64\\chrome.exe", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const candidate = path.join(base, dir, rel);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

/**
 * Locates a Chromium binary per environment:
 *  - Vercel/Linux lambda: @sparticuz/chromium's bundled binary
 *  - local dev/e2e: Playwright's chromium, env override, or installed Chrome
 */
async function launchBrowser() {
  const puppeteer = await import("puppeteer-core");

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) executablePath = await findPlaywrightChromium();
  if (!executablePath) {
    const candidates =
      process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
    const { existsSync } = await import("node:fs");
    executablePath = candidates.find((p) => existsSync(p));
  }
  if (!executablePath) {
    throw new Error(
      "No Chromium found for PDF export — set PUPPETEER_EXECUTABLE_PATH or install Chrome/Playwright.",
    );
  }

  return puppeteer.launch({ executablePath, headless: true });
}

/**
 * Session → PDF rendered by Chromium (MVP-24): real browser text shaping is
 * the only dependable way to render Bangla conjuncts/matras correctly.
 */
export async function generateSessionPdf(data: SessionExportData): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // setContent only waits for load/domcontentloaded; document.fonts.ready
    // then guarantees the Google-hosted Bangla webfont has actually loaded.
    await page.setContent(buildExportHtml(data), { waitUntil: "load", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "12mm", left: "0", right: "0" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
