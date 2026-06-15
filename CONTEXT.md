# Doppio — Project Context

> **Living doc.** Update this every time we lock a decision, ship a feature, or change
> infra. Keep it scannable. Newest "Changelog" entry on top. Last updated: **2026-06-15**.

## What Doppio is
Bangla-first AI "second brain". You record/import conversations → they're transcribed,
summarized, and made searchable/queryable. Surfaces:
- **Web portal** (Next.js 15 App Router) + **Chrome extension** (MV3 tab capture).
- **Android app** (Kotlin + Jetpack Compose) — the current focus.
Free-tier stack: **Vercel** (web/API) + **Supabase** (Postgres+pgvector, Auth, Storage) +
**TwinMind** (STT) + **OpenAI** (LLM + embeddings).

## Infra & accounts
- **GitHub:** `tarekujjaman/doppio` (public). API access via `git credential fill`.
- **Vercel prod:** `https://doppio-gamma.vercel.app` (deploys from `main`).
- **Supabase project:** `tlpjezahslgtodxddzws` (`https://tlpjezahslgtodxddzws.supabase.co`),
  region `aws-1-ap-southeast-1`. Storage bucket: `doppio-audio`.
- **STT:** TwinMind Ear-3 — base `https://api.twinmind.dev/v1` (the **.dev** API, NOT .com).
  Accepts mp3/m4a/wav/flac/ogg/aac; **not** webm/mp4 → server transcodes via ffmpeg-static.
  OpenAI Whisper is the fallback.
- **LLM/embeddings:** OpenAI `gpt-4o-mini` + `text-embedding-3-small` (1536-dim).
- Secrets live in `.env.local` (root) + `apps/web/.env.local` (gitignored). Android public
  config in `apps/android/local.properties` (gitignored): SUPABASE_URL/ANON_KEY, API_BASE_URL.

## Repo & branches
- `main` — canonical; **prod web deploys from here**. Web/server changes ship via PR → squash-merge.
- `feat/android-revamp` — the Android app (the active mobile branch; APKs built here).
- `feat/extension-cockpit` — Chrome extension work (current default checkout).
- DB migrations are applied **directly to prod** (idempotent SQL) AND committed as migration files.

## Android app
- **Package:** `com.doppio` (release) / `com.doppio.debug` (debug, `.debug` suffix).
- **Current version:** `0.4.1` (versionCode 14). minSdk 26, target/compile 36, KSP1.
- **Stack:** Compose Material 3, Hilt, Room, WorkManager, supabase-kt (auth+storage),
  Retrofit/OkHttp/kotlinx-serialization, Media3, OkHttp SSE.
- **Auth:** Supabase magic-link (deep link `doppio://auth-callback`) **+ password login**
  (sign-in / create account / forgot-password; "Set password" in Settings for magic-link users).
- **Build / install / publish:**
  - Build dir: `apps/android`. `./gradlew :app:assembleDebug` / `:app:assembleRelease`.
  - Debug APK: `app-debug.apk` (~24 MB, debuggable, slower). Release: `app-release.apk`
    (~3 MB, R8 + shrink; **recommended**). Release signing key: `apps/android/release.keystore`
    + `keystore.properties` (gitignored; generated locally; pwd `doppio-test-2026`).
  - Install via adb (device on USB): `adb install -r <apk>`. Verify visually with
    `adb exec-out screencap -p > x.png`.
  - Publish: GitHub release `android-test-<ver>` (prerelease) with `Doppio-release.apk` +
    `Doppio-debug.apk`. Releases page: `/releases`.

## Locked features & decisions
- **Audio model:** recordings stored on-device; sent transiently for STT; cloud copy
  **deleted after transcription** (`privateMode`/INIT-18). Transcript is the asset.
- **Detailed summaries:** `Summary.detail` = sectioned markdown (## Overview + per-topic
  bullets). Web + Android render it (Android `MarkdownText`).
- **Action items:** omit `owner` when unclear — never emit placeholders ("Unspecified", etc.).
- **Mobile capture upload (fixed, reliable):**
  - 2-stage WorkManager chain — `CaptureSessionWorker` creates the session/upload-URL ONCE;
    `CaptureUploadWorker` uploads→ingests→polls and retries **reuse** the session (no duplicate
    "Queued" items). `enqueueUniqueWork`.
  - Upload uses a **direct OkHttp signed PUT** to `…/storage/v1/object/upload/sign/{bucket}/{path}?token=`
    (x-upsert + apikey) — NOT supabase-kt storage (which failed silently on-device).
  - **API client timeouts bumped** (connect 30s / read+write 120s / call 150s) — the real
    root cause of duplicates + stuck uploads was the 10s default timing out on free-tier cold starts.
  - **Background recording:** mic **foreground service** (`RecordingService`) keeps capture
    alive with the screen off; ongoing notification; tap → opens the live recording.
  - Library cache reconciles on full refresh (deleted sessions no longer linger locally).
- **Brand / design system** (matches web tailwind tokens): plum `#3B2C56` (primary), coral
  `#F0664A` (accent), spark `#F4A47E`, paper `#F3EEE9`, warm slate neutrals, Inter.
  Adaptive launcher icon (reversed mark on plum) + in-app `DoppioMark`/`DoppioWordmark`/`DoppioLockup`.
  Branded launch (no white flash; Android 12+ splash = mark on plum).
- **Home = dashboard** (greeting, stat cards: sessions count + recorded time, recent list).
- **Ask Doppio** (global personal memory chat) — see below.

## Ask Doppio (global memory chat)
- **Server:** `POST /api/ask` (user-scoped SSE RAG over the user's WHOLE memory) +
  `GET /api/ask` (history list + load a conversation by `?threadId=`). `apps/web/app/api/ask/route.ts`.
- **Indexing:** `index-session.ts` embeds transcript **+ summary + notes + action items**,
  each `RagChunk.kind`-tagged. `retrieveChunksGlobal(userId)` joins Session (strictly userId-scoped).
  Backfill: `apps/web/scripts/reindex-all.mts`.
- **Threads:** `AskThread.userId` + nullable `sessionId`. A global memory thread = userId set,
  sessionId null. POST with no threadId starts a NEW chat; `threadId` continues it → **chat history**.
- **Android:** `feature/ask/AskDoppioScreen.kt` + `AskDoppioViewModel.kt`, `AskClient.streamGlobal`.
  Entry: dashboard "Ask Doppio" card + top-bar chat icon. Citation chips → open source session.
  History drawer (clock icon) + New chat. Animated "Doppio is thinking…" status + streaming.
  **Export conversation as .txt** (share icon → `FileExporter.exportText`).

## Known issues / next
- Citation tap opens the source session but does not yet seek to the exact timestamp.
- Two-app confusion resolved: debug variant uninstalled; only `com.doppio` (release) on the device.
- Free-tier backend cold starts add first-request latency (not an app bug; a keep-alive cron
  or paid tier would smooth it).

## How we work (conventions)
- Web/server: change in a worktree off `origin/main` → PR → verify Vercel preview is green → squash-merge.
- DB migrations: apply idempotent SQL directly to prod + commit the migration file.
- Android: work on `feat/android-revamp`; bump `versionName`/`versionCode`; build, install via adb,
  verify on-device with screenshots; publish a GitHub `android-test-<ver>` release.
- **Update this file whenever a decision/feature/infra change is locked.**

## Changelog
- **0.4.1** — Ask Doppio chat redesign (animated thinking, avatars, suggested prompts, streaming
  cursor) + chat history (drawer, New chat, resume). `[seg:N]` markers hidden.
- **0.4.0** — Ask Doppio: global memory RAG chat (server `/api/ask` + Android screen), citations,
  `.txt` export, dashboard entry. Migration: `RagChunk.kind`, `AskThread.userId`.
- **0.3.x** — duplicate-upload fix (2-stage chain + OkHttp PUT + timeouts), background recording
  (FGS), branded icon/splash + plum/coral redesign, dashboard home, password login, faster R8 release.
- **(web)** detailed markdown summaries; action-item owner-omit; TwinMind `.dev` base + webm→wav
  converter + long-audio chunking/timeout.
