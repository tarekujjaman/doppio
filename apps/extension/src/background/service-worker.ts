import { APP_URL } from "../lib/config";
import { CAPTURING_FLAG, OFFSCREEN_PATH, type Message } from "../lib/messages";

// Force openPanelOnActionClick OFF (it's a persisted profile setting from an
// earlier build) so the action click fires onClicked instead of auto-opening
// the panel. The click is the only context where tabCapture is authorized.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

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
    offscreenReady = null;
    throw err;
  }
}

// supabase-js stores the session under sb-<ref>-auth-token in chrome.storage.local.
// The SW can read it (offscreen docs can't), so it reads the token here.
async function getStoredToken(): Promise<string | null> {
  const all = await chrome.storage.local.get(null);
  const key = Object.keys(all).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  if (!key) return null;
  try {
    const v = typeof all[key] === "string" ? JSON.parse(all[key] as string) : all[key];
    return v?.access_token ?? null;
  } catch {
    return null;
  }
}

const isCapturing = async () => Boolean((await chrome.storage.session.get(CAPTURING_FLAG))[CAPTURING_FLAG]);
const setCapturing = (v: boolean) => chrome.storage.session.set({ [CAPTURING_FLAG]: v });

function notify(message: Message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// The toolbar icon both opens the panel and starts/stops recording the tab.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  void chrome.sidePanel.open({ tabId: tab.id }).catch(() => {}); // sync: gesture-bound
  void onIconClick(tab);
});

async function onIconClick(tab: chrome.tabs.Tab) {
  const token = await getStoredToken();
  if (await isCapturing()) {
    notify({ type: "OFFSCREEN_STOP", token: token ?? "" }); // toggle: second click stops
    return;
  }
  if (!token) {
    notify({ type: "NEEDS_SIGNIN" });
    return;
  }
  if (tab.url && /^(chrome|edge|about|chrome-extension|chrome-untrusted|devtools|view-source):/.test(tab.url)) {
    notify({ type: "CAPTURE_ERROR", message: "This page can't be recorded — open a normal website tab." });
    return;
  }

  let streamId: string;
  try {
    // Called inside the onClicked invocation → tabCapture is authorized.
    streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id! }, (id) => {
        const err = chrome.runtime.lastError;
        if (err || !id) reject(new Error(err?.message ?? "Could not get tab stream."));
        else resolve(id);
      });
    });
  } catch (err) {
    notify({ type: "CAPTURE_ERROR", message: err instanceof Error ? err.message : String(err) });
    return;
  }

  await ensureOffscreen();
  await setCapturing(true);
  notify({
    type: "OFFSCREEN_START",
    streamId,
    appUrl: APP_URL,
    title: tab.title?.slice(0, 200) || "Browser recording",
    token,
  });
}

chrome.runtime.onMessage.addListener((msg: Message) => {
  if (msg.type === "STOP_CAPTURE") {
    notify({ type: "OFFSCREEN_STOP", token: msg.token }); // panel supplies a fresh token
  } else if (
    msg.type === "CAPTURE_STOPPED" ||
    msg.type === "CAPTURE_UPLOADED" ||
    (msg.type === "CAPTURE_ERROR" && !msg.recoverable)
  ) {
    void setCapturing(false); // recording finished (or failed unrecoverably)
  }
  return false;
});
