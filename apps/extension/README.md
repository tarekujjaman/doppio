# Doppio — Chrome Extension

Captures the **audio of your current browser tab** (Meet, Zoom web, a YouTube
lecture, anything) and sends it into Doppio: transcript → summary → action
items, reachable from the web portal.

MV3 · plain Vite build (side panel + service worker + offscreen document) ·
talks to the deployed web app at `VITE_APP_URL`.

## Architecture

| Piece | Role |
|---|---|
| `src/sidepanel` | React side panel: Supabase password sign-in, Record/Stop, timer, recent sessions, "Open in Doppio" |
| `src/background/service-worker.ts` | `tabCapture.getMediaStreamId` + offscreen-document lifecycle + message routing |
| `src/offscreen/offscreen.ts` | `getUserMedia(tab)` → re-routed to an AudioContext (tab stays audible) → `MediaRecorder` → upload (`upload-url` → Supabase signed PUT → `ingest`) |

Auth is **token-based** (the extension is cross-origin, so the portal's
cookies can't be sent): the panel signs into Supabase directly, stores the
session in `chrome.storage.local`, and sends `Authorization: Bearer <token>`.
The web API accepts that Bearer token (see `apps/web/lib/supabase/server.ts`)
and allows the `chrome-extension://` origin via CORS (`apps/web/middleware.ts`).

Tab recordings are webm, which TwinMind doesn't accept, so the server
transcribes them with the Whisper fallback (still Bengali-capable).

## Build

```bash
# from the repo root
cp apps/extension/.env.example apps/extension/.env   # fill in the values
pnpm --filter @doppio/extension build                # → apps/extension/dist
```

`.env` (baked at build time; the anon key is publishable):

```
VITE_APP_URL="https://doppio-gamma.vercel.app"
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon key>"
```

## Load it in Chrome

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `apps/extension/dist`.
3. Click the Doppio icon once to open the panel and **sign in** (same
   email/password as the portal — set a password via "Forgot password?" if you
   only ever used a magic link).
4. Open a **normal website tab** with audio (e.g. a YouTube video) — not a
   `chrome://` page.
5. **Click the Doppio toolbar icon on that tab → recording starts immediately.**
   The panel shows a live timer.
6. Click **Stop & transcribe** in the panel (or click the toolbar icon again).
   The session appears in the panel and the portal.

> Chrome only authorizes tab capture from the toolbar-icon click itself, so the
> icon is the start button: click it on the tab you want to record. `chrome://`
> pages and the extension's own pages can't be captured.

## Notes / limits

- Tab **audio** only (no mic); a future version can add mic capture.
- Max upload 25 MB (the server's Whisper-fallback limit) — long meetings
  should be split. Async/long-file handling is a future seam.
- The extension is not published to the Web Store; it's loaded unpacked.
