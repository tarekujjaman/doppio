# Doppio — Chrome Extension

Captures the **audio of your current browser tab** (Meet, Zoom web, a YouTube
lecture, anything) and streams it into Doppio: **near-real-time** transcript →
summary → action items. The transcript fills in *while you record*; the summary
lands within seconds of Stop.

MV3 · plain Vite build (side panel + service worker + offscreen document) ·
talks to the deployed web app at `VITE_APP_URL`.

## Architecture

| Piece | Role |
|---|---|
| `src/sidepanel` | React side panel. Three tabs — **Record** (capture card, live level meter, live transcript preview, ★ mark-moment, usage meter, recent sessions w/ summary peek + rename/delete/copy-link), **Tasks** (open action items, checkable), **Search** (full-text over transcripts/notes). Settings panel + "Portal" gateway to the web app. |
| `src/background/service-worker.ts` | Toolbar-click → silent-tab guard (`tab.audible`) → `tabCapture.getMediaStreamId` → offscreen lifecycle + message routing. Also: READY/FAILED **notification** after a recording finishes, and an `Alt+Shift+R` **command** to stop from anywhere. |
| `src/offscreen/offscreen.ts` | `getUserMedia(tab)` → AudioContext (tab stays audible) → `ScriptProcessorNode` PCM → 16 kHz mono **WAV chunks (~90 s)** → streamed to the API live. No `MediaRecorder`, no webm, no single upload. |
| `src/sidepanel/Logo.tsx` | The brand mark (two overlapping circles) + wordmark. Icons are generated from the same geometry by `scripts/gen-icons.mjs`. |

Auth is **token-based** (the extension is cross-origin, so the portal's
cookies can't be sent): the panel signs into Supabase directly, stores the
session in `chrome.storage.local`, and sends `Authorization: Bearer <token>`.
The web API accepts that Bearer token (see `apps/web/lib/supabase/server.ts`)
and allows the `chrome-extension://` origin via CORS (`apps/web/middleware.ts`).

## Live capture pipeline

Recording no longer waits for Stop. The offscreen doc taps the tab's audio,
slices it into ~90 s WAV chunks, and transcribes each **during** the meeting:

1. **Start** — `POST /api/sessions/start` opens a `RECORDING` session up front.
2. **Per chunk** — `POST /api/sessions/{id}/transcribe-chunk?index&startMs` with
   the raw WAV body. The server transcribes it and appends the segments at the
   right time offset. WAV routes to the **primary STT (TwinMind)** — no Whisper
   fallback, no Bangla double-pass. A 90 s chunk is ~2.9 MB, under Vercel's
   ~4.5 MB body limit, so chunks POST **directly** — audio is never stored, it
   lives only in memory for the one call.
3. **Finalize** — on Stop, `POST /api/sessions/{id}/finalize` meters once
   (server-derived) and runs summary + action items + RAG index → `READY` in
   seconds, because transcription is already done.

Plain file uploads still use the older `upload-url → signed PUT → ingest` path
(unchanged); only the extension's live capture uses the chunked endpoints.

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

Icons are committed under `public/icons/`. To regenerate them from the brand
mark: `node apps/extension/scripts/gen-icons.mjs`.

## Load it in Chrome

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `apps/extension/dist`. (Reload it here after every
   rebuild.)
3. Click the Doppio icon once to open the panel and **sign in** (same
   email/password as the portal).
4. Open a **normal website tab that is playing audio** (e.g. a YouTube video) —
   not a `chrome://` page and not a silent tab.
5. **Click the Doppio toolbar icon on that tab → recording starts.** The panel
   shows a live timer, level meter, and the transcript filling in. Use
   **★ Mark this moment** to drop a timestamped note.
6. Click **Stop & transcribe** (or the toolbar icon again, or `Alt+Shift+R`).
   The summary/action items land within seconds; you get a notification when the
   session is ready.

> Chrome only authorizes tab capture from the toolbar-icon click itself, so the
> icon is the start button. A tab that isn't currently producing sound is
> refused with a hint — start playback, then click again. `chrome://` pages and
> the extension's own pages can't be captured.

## Notes / limits

- Tab **audio** only (no mic yet); mic + tab mixing is a future seam.
- The backend endpoints (`start` / `transcribe-chunk` / `finalize`) must be
  deployed to the `VITE_APP_URL` target, and prod needs `STT_PROVIDER=twinmind`
  + `TWINMIND_API_KEY` for the fast path.
- Chunks reuse the start token, so meetings beyond ~1 h may drop late chunks
  until token refresh lands. A chunk that fails every retry is dropped
  best-effort (the meeting continues). Hard cap ~120 min/recording.
- `ScriptProcessorNode` is deprecated-but-works; an `AudioWorklet` is a clean
  follow-up.
- The extension is not published to the Web Store; it's loaded unpacked.
