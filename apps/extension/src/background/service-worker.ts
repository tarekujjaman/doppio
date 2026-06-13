import { APP_URL } from "../lib/config";
import { OFFSCREEN_PATH, type Message } from "../lib/messages";

// CRITICAL: force openPanelOnActionClick OFF. It's a persisted profile setting,
// so an earlier build that set it true keeps auto-opening the panel WITHOUT
// firing onClicked — meaning activeTab is never granted and tabCapture fails.
// Running this at top level resets it on every service-worker startup.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// Open the side panel from the action click. The explicit click is what grants
// the activeTab permission tabCapture needs for the clicked tab.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) void chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});

// Serialize creation so two rapid START_CAPTURE calls can't both create a doc
// ("Only a single offscreen document may be created").
let offscreenReady: Promise<void> | null = null;
async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return offscreenReady;
  offscreenReady = (async () => {
    const existing = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });
    if (existing.length > 0) return;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Record tab audio for transcription.",
    });
  })();
  try {
    await offscreenReady;
  } catch (err) {
    offscreenReady = null; // allow retry after a genuine failure
    throw err;
  }
}

async function startCapture(token: string): Promise<{ ok: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "No active tab to capture." };
  if (tab.url && /^(chrome|edge|about|chrome-extension|chrome-untrusted):/.test(tab.url)) {
    return { ok: false, error: "This page can't be captured. Open a normal website tab." };
  }

  // getMediaStreamId must run in the SW; the id is consumed in the offscreen doc.
  // It needs activeTab on this tab, granted by clicking the toolbar icon.
  let streamId: string;
  try {
    streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        const err = chrome.runtime.lastError;
        if (err || !id) reject(new Error(err?.message ?? "Could not get tab stream."));
        else resolve(id);
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/invoked|activeTab|permission/i.test(msg)) {
      return {
        ok: false,
        error: "Click the Doppio toolbar icon on the tab you want to record, then press Record.",
      };
    }
    return { ok: false, error: msg };
  }
  await ensureOffscreen();

  await chrome.runtime.sendMessage({
    type: "OFFSCREEN_START",
    streamId,
    token,
    appUrl: APP_URL,
    title: tab.title?.slice(0, 200) || "Browser recording",
  } satisfies Message);

  return { ok: true };
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === "START_CAPTURE") {
    startCapture(message.token)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
  if (message.type === "STOP_CAPTURE") {
    chrome.runtime
      .sendMessage({ type: "OFFSCREEN_STOP", token: message.token } satisfies Message)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  // CAPTURE_TICK and other broadcasts: receiving them keeps the SW awake during
  // a recording; no handling needed.
  return false;
});
