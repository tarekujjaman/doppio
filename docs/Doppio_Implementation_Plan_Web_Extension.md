# Doppio — Implementation Plan: Web Portal + Chrome Extension

**Purpose:** This document is the build instruction set for Claude Code. It implements the first working version of Doppio — the **web portal** (central hub) and the **Chrome extension** (quick capture) — per the locked feature matrix (v1.0) and PRD v1.0. Requirement IDs (e.g. `MVP-28`) trace back to those documents.

**Read this first, Claude Code:**
- Build in the milestone order in §8. Do not skip ahead; later milestones depend on earlier ones.
- Each milestone ends with a **Definition of Done** checklist — verify it before moving on.
- Make pragmatic substitutions where flagged (STT provider, payment sandbox) but keep the interfaces stable.
- Keep everything in **one monorepo** as specified in §4.
- TypeScript everywhere. No `any` unless unavoidable. Write tests where specified.

---

## 1. Scope

### In scope (this build)
| Area | Requirements |
|---|---|
| Backend foundation: auth, API, data model | `INIT-01`, `INIT-02`, `INIT-19` |
| Web portal shell, auth, navigation | `MVP-28` |
| Session library & dashboard | `MVP-29`, `INIT-16`, `INIT-17` |
| Session workspace (transcript / summary / notes / playback) | `MVP-30`, `MVP-06`, `INIT-14` (web rendering) |
| AI pipeline: summaries, action items, title/tags | `MVP-01`, `MVP-02`, `MVP-03`, `MVP-04`, `MVP-05`, `MVP-07` |
| Search + Ask Doppio (single-session RAG) | `MVP-08`, `MVP-09`, `MVP-10`, `MVP-11`, `MVP-31` |
| Audio/video upload → transcribe & summarize | `MVP-35` |
| Transcript / text import | `MVP-37` |
| Billing & plans (sandbox payments) | `MVP-15`, `MVP-16`, `MVP-17` (sandbox), `MVP-19`, `MVP-32` |
| Settings & privacy | `MVP-33`, `INIT-03` (web i18n scaffold), `INIT-18` (private-mode flag) |
| Export & share | `MVP-23`, `MVP-24`, `MVP-34` |
| Chrome extension: tab-audio capture + panel | `MVP-12`, `MVP-13` |
| Cross-surface sync (web ↔ extension via one backend) | `MVP-20` (web/extension subset) |

### Out of scope (do NOT build now)
- Mobile apps (Android/iOS) — separate build.
- Training/fine-tuning any STT model — use a provider behind the interface in §6.
- Real bKash/Nagad/Rocket credentials — sandbox/stub only, but build the full flow.
- V1+ features (deep cross-session RAG, calendar, meeting bot, workspaces, diarization), V2/V3 features. The schema must not block them (see §5 notes), but no UI/endpoints for them.

---

## 2. Product context (one paragraph)

Doppio is a Bangla-first AI second brain: capture or upload audio → Bangla/English transcription (incl. Bangla–English code-switching) → AI summary, action items, searchable memory, and Ask-style Q&A. Web portal = manage and use everything. Chrome extension = quick on/off capture of browser-tab meetings that deep-links into the portal. Pricing: free tier with capped minutes; Pro at Tk 200–300/month via mobile financial services (sandbox for now). Bangla quality is a launch gate, not a nice-to-have: all AI features must work on Bangla and code-switched input.

---

## 3. Tech stack (decided — do not relitigate)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Simple, fast, Claude Code-friendly |
| Web app | **Next.js 14+ (App Router) + TypeScript** | One framework for portal UI + API routes where sensible |
| API | **Next.js Route Handlers** for app API + a small **Node worker** (BullMQ) for pipeline jobs | Avoid a second framework; jobs need a worker |
| DB | **PostgreSQL + Prisma** | Relational fits sessions/users/billing; Prisma for speed |
| Queue/cache | **Redis** (BullMQ + rate limiting) | Transcription/summarization are async jobs |
| Object storage | **S3-compatible** (MinIO in dev) | Audio files |
| Auth | **Phone OTP (primary) + email magic-link (fallback)**, JWT (short-lived access + refresh), httpOnly cookies | Mirrors `INIT-01/02`; no card/credit assumptions |
| SMS (dev) | Console/stub provider with interface for SMS Box later | BD provider pluggable |
| STT | **Provider interface** (§6): default adapter = OpenAI Whisper API (`language: bn` supported); optional Google STT adapter | Bangla-capable today; swappable per `INIT-10` |
| LLM | **Anthropic API (Claude)** via a thin `LLMClient` wrapper | Summaries, action items, tags, Ask |
| Embeddings/search | **Postgres full-text (FTS) for keyword** + **pgvector** for Ask RAG chunks | One DB, no extra infra |
| UI | Tailwind CSS + shadcn/ui + lucide-react | Fast, clean |
| State/data | TanStack Query | Server-state heavy app |
| Audio player | wavesurfer.js | Waveform + timestamp sync |
| Extension | **Manifest V3**, Vite + CRXJS, TypeScript, React side panel | Modern MV3 build |
| Testing | Vitest (unit), Playwright (e2e happy paths) | Pragmatic coverage |
| Lint/format | ESLint + Prettier (default configs) | Consistency |

**Environment variables (create `.env.example`):**
```
DATABASE_URL=
REDIS_URL=
S3_ENDPOINT= / S3_BUCKET= / S3_ACCESS_KEY= / S3_SECRET_KEY=
JWT_SECRET= / JWT_REFRESH_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=            # whisper adapter
STT_PROVIDER=whisper       # whisper | google | mock
SMS_PROVIDER=console       # console | smsbox
PAYMENT_PROVIDER=sandbox   # sandbox | bkash
APP_URL=http://localhost:3000
```

Provide `docker-compose.yml` for Postgres (with pgvector), Redis, MinIO.

---

## 4. Repository structure

```
doppio/
├── apps/
│   ├── web/                  # Next.js portal (UI + API route handlers)
│   │   ├── app/
│   │   │   ├── (auth)/login/ ...
│   │   │   ├── (portal)/dashboard/ ...
│   │   │   ├── (portal)/sessions/[id]/ ...
│   │   │   ├── (portal)/search/ ...
│   │   │   ├── (portal)/billing/ ...
│   │   │   ├── (portal)/settings/ ...
│   │   │   ├── share/[token]/        # public share page
│   │   │   └── api/                  # route handlers (§7)
│   │   └── ...
│   ├── worker/               # BullMQ worker: transcribe, summarize, index, export
│   └── extension/            # Chrome MV3 extension
│       ├── src/background/   # service worker
│       ├── src/sidepanel/    # React panel
│       ├── src/offscreen/    # offscreen doc for tabCapture recording
│       └── manifest.ts
├── packages/
│   ├── db/                   # Prisma schema + client + migrations + seed
│   ├── core/                 # shared types, zod schemas, constants (plans, limits)
│   ├── stt/                  # STT provider interface + whisper/google/mock adapters
│   ├── ai/                   # LLMClient + prompt templates + output zod-parsers
│   └── ui/                   # (optional) shared UI primitives if needed
├── docker-compose.yml
├── turbo.json / pnpm-workspace.yaml
└── README.md                 # setup + run instructions (keep updated)
```

---

## 5. Data model (Prisma — implement exactly; extend, don't break)

```prisma
model User {
  id            String   @id @default(cuid())
  phone         String?  @unique
  email         String?  @unique
  name          String?
  locale        String   @default("bn")        // "bn" | "en"  (INIT-03)
  privateMode   Boolean  @default(false)        // INIT-18 flag (default for new sessions)
  plan          Plan     @default(FREE)
  planExpiresAt DateTime?
  createdAt     DateTime @default(now())
  sessions      Session[]
  usage         UsageLedger[]
  payments      Payment[]
  otps          OtpCode[]
}

enum Plan { FREE PRO }

model OtpCode {
  id        String   @id @default(cuid())
  userId    String?
  phone     String?
  email     String?
  codeHash  String
  expiresAt DateTime
  consumed  Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User?    @relation(fields: [userId], references: [id])
}

model Session {
  id          String        @id @default(cuid())
  userId      String
  title       String        @default("Untitled session")
  source      SessionSource // EXTENSION | UPLOAD | TEXT_IMPORT (mobile later)
  status      SessionStatus // RECORDING | UPLOADED | TRANSCRIBING | SUMMARIZING | READY | FAILED
  language    String?       // detected: "bn" | "en" | "mixed"
  durationSec Int?
  audioKey    String?       // S3 key; null if privateMode discarded audio or text import
  privateMode Boolean       @default(false)     // INIT-18: if true, delete audio after transcription
  tags        String[]      @default([])
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  user        User          @relation(fields: [userId], references: [id])
  transcript  TranscriptSegment[]
  summary     Summary?
  actionItems ActionItem[]
  notes       Note[]
  chunks      RagChunk[]
  shares      ShareLink[]
  askThreads  AskThread[]
  @@index([userId, createdAt])
}

enum SessionSource { EXTENSION UPLOAD TEXT_IMPORT MOBILE }
enum SessionStatus { RECORDING UPLOADED TRANSCRIBING SUMMARIZING READY FAILED }

model TranscriptSegment {
  id        String  @id @default(cuid())
  sessionId String
  idx       Int
  startMs   Int
  endMs     Int
  text      String
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@unique([sessionId, idx])
}

model Summary {
  id         String  @id @default(cuid())
  sessionId  String  @unique
  overview   String
  decisions  String?
  nextSteps  String?
  language   String  // language it was written in
  model      String
  tokensUsed Int?
  session    Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model ActionItem {
  id        String   @id @default(cuid())
  sessionId String
  text      String
  owner     String?
  dueHint   String?
  done      Boolean  @default(false)
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model Note {
  id        String   @id @default(cuid())
  sessionId String
  anchorMs  Int?     // optional timestamp anchor (MVP-06)
  text      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model RagChunk {
  id        String                @id @default(cuid())
  sessionId String
  idx       Int
  text      String
  startMs   Int?
  embedding Unsupported("vector(1536)")?
  session   Session               @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId])
}

model AskThread {
  id        String      @id @default(cuid())
  sessionId String
  createdAt DateTime    @default(now())
  messages  AskMessage[]
  session   Session     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model AskMessage {
  id        String   @id @default(cuid())
  threadId  String
  role      String   // "user" | "assistant"
  text      String
  citations Json?    // [{segmentIdx,startMs}]
  createdAt DateTime @default(now())
  thread    AskThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
}

model UsageLedger {
  id        String   @id @default(cuid())
  userId    String
  kind      String   // "transcribe_seconds" | "ask_call" | "summary_call"
  amount    Int
  sessionId String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
}

model Payment {
  id         String   @id @default(cuid())
  userId     String
  provider   String   // "sandbox" | "bkash" | ...
  providerRef String?
  amountBdt  Int
  status     String   // "initiated" | "completed" | "failed" | "refunded"
  plan       Plan
  periodDays Int      @default(30)
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
}

model ShareLink {
  id        String   @id @default(cuid())
  sessionId String
  token     String   @unique
  scope     String   @default("summary") // "summary" | "full"
  expiresAt DateTime?
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

**Future-proofing notes (do not implement, do not block):** sessions later gain `workspaceId` (V1 teams) and documents become another source kind (V1-19); RagChunk is already source-agnostic. Keep user-scoping in every query (`where userId`) so adding workspaces later is additive.

**Plan limits (constants in `packages/core`):**
```ts
export const PLAN_LIMITS = {
  FREE: { transcribeMinutesPerMonth: 120, askCallsPerDay: 20 },
  PRO:  { transcribeMinutesPerMonth: 3000, askCallsPerDay: 500 }, // "unlimited" with abuse ceiling
};
export const PRO_PRICE_BDT = 250; // Tk 200–300 band; single price point for now
```
**Quota policy (decided for this build):** uploaded audio minutes count the same as live minutes against the cap (`MVP-35` ties into `MVP-15`).

---

## 6. STT provider interface (the INIT-10/11 abstraction)

```ts
// packages/stt/src/types.ts
export interface SttProvider {
  /** Batch transcription of a stored audio file. */
  transcribeFile(input: {
    audioUrl: string;            // presigned S3 URL
    languageHint?: "bn" | "en" | "auto";
  }): Promise<{
    language: string;            // detected
    segments: { startMs: number; endMs: number; text: string }[];
  }>;
}
```
- Implement `WhisperProvider` (OpenAI audio transcriptions API, `language: "bn"` when hinted, else auto — Whisper handles Bangla and code-switch acceptably for v0), `MockProvider` (returns canned Bangla+English segments — used in tests/dev without keys), and stub `GoogleProvider` (interface-complete, TODO body).
- Selection via `STT_PROVIDER` env. **All app code depends only on the interface.**
- Live/streaming transcription is **not** required for this build: the extension records, then submits the file for batch transcription (see §9). Leave a `// TODO(stream)` seam.

## 6b. AI layer (`packages/ai`)

- `LLMClient` wrapping Anthropic messages API; model name from env, default a fast model.
- Prompt templates (keep in versioned files, not inline strings):
  - `summarize.ts` — input: transcript text + target language (`bn`/`en` = user locale); output (zod-validated JSON): `{ overview, decisions?, nextSteps?, title, tags[3-5] }`. **Must produce fluent Bangla output for Bangla/mixed input** (`MVP-01/02/07`, `MVP-27`).
  - `actions.ts` — output: `{ items: {text, owner?, dueHint?}[] }`, deduped (`MVP-04`).
  - `ask.ts` — RAG answer over retrieved chunks with instruction to cite segment indices; answer in the question's language (`MVP-10`).
- Log `tokensUsed` per call into Summary/UsageLedger (`MVP-02` cost tracking).
- **Bangla validation fixture (`MVP-27` slice):** include 3 fixture transcripts (Bangla, English, code-switched) and a vitest that runs summarize/actions against the MockProvider+stubbed LLM in CI shape, plus a manual `pnpm eval:bangla` script that calls the real LLM and prints outputs for human review.

---

## 7. API surface (route handlers under `apps/web/app/api`)

All JSON; zod-validate every body; all session-scoped routes enforce ownership. Errors: `{ error: { code, message } }`.

**Auth (`INIT-01/02`, `MVP-28`)**
- `POST /api/auth/otp/request` `{ phone? , email? }` → sends OTP (console in dev); rate-limit 5/hr/identity (Redis).
- `POST /api/auth/otp/verify` `{ phone?/email?, code }` → sets httpOnly access+refresh cookies; creates user if new.
- `POST /api/auth/refresh` / `POST /api/auth/logout`
- `GET /api/me` → profile, plan, usage snapshot.

**Sessions (`MVP-29/30`, `INIT-16/17`, `MVP-35/37`)**
- `GET /api/sessions?query=&cursor=` → paginated list (title search server-side).
- `POST /api/sessions/upload-url` `{ filename, contentType, privateMode? }` → creates Session(status=UPLOADED pending) + presigned S3 PUT URL. Accept mp3/wav/m4a/mp4/webm; max 500MB.
- `POST /api/sessions/:id/ingest` → after client finishes upload; **checks quota (§5 limits) using media duration**, rejects with `QUOTA_EXCEEDED` if over; enqueues `transcribe` job.
- `POST /api/sessions/import-text` `{ title?, text }` → creates TEXT_IMPORT session as READY with one synthetic segment + runs summarize+index jobs (`MVP-37`).
- `GET /api/sessions/:id` → session + transcript + summary + actions + notes.
- `PATCH /api/sessions/:id` `{ title?, tags? }` · `DELETE /api/sessions/:id` (cascades; deletes S3 object).
- `GET /api/sessions/:id/audio` → presigned GET (404 if privateMode discarded).
- `POST /api/sessions/:id/regenerate-summary` (`MVP-03`).

**Notes & actions (`MVP-06`, `MVP-05`)**
- `POST/PATCH/DELETE /api/sessions/:id/notes` · `PATCH /api/action-items/:id` `{ done?, text? }`
- `GET /api/action-items?done=false` → aggregated across sessions.

**Search & Ask (`MVP-08/09/10/11/31`)**
- `GET /api/search?q=&from=&to=` → Postgres FTS over segments+notes+titles with highlights. Use `simple` config (works tolerably for Bangla tokens); add trigram fallback.
- `POST /api/sessions/:id/ask` `{ threadId?, question }` → embed question, pgvector top-k within session, LLM answer with `citations`; stream via SSE; persist thread.

**Billing (`MVP-15/16/17/19/32`)**
- `GET /api/billing` → plan, expiry, current-month usage vs limits.
- `POST /api/billing/checkout` `{ plan: "PRO" }` → creates Payment(initiated) and returns `paymentUrl` (sandbox page).
- Sandbox flow: `/billing/sandbox/:paymentId` page with "Simulate success / failure" buttons → `POST /api/billing/webhook` (same shape a real bKash webhook will use: `{ providerRef, status }`) → on success set plan=PRO, planExpiresAt=+30d.
- `POST /api/billing/cancel` → plan reverts to FREE at expiry (no immediate downgrade).
- **Keep `PaymentProvider` interface** (`createCheckout`, `verifyWebhook`) so the real bKash adapter drops in later (`MVP-17`).

**Share & export (`MVP-23/24/34`)**
- `POST /api/sessions/:id/share` `{ scope, expiresInDays? }` → ShareLink token; `DELETE` to revoke. Public page `/share/:token` renders summary (and transcript if scope=full), noindex.
- `GET /api/sessions/:id/export?format=pdf|docx` → worker-generated file; **embed a Bangla-capable font (Noto Sans Bengali) in the PDF**; DOCX via `docx` npm. Include title, summary, action items, transcript, notes.

**Settings (`MVP-33`)**
- `PATCH /api/me` `{ name?, locale?, privateMode? }`
- `GET /api/me/export` → JSON dump of user data (zip later if large). `DELETE /api/me` → full account deletion (cascade + S3 cleanup).

**Extension support (`MVP-12/13/20`)**
- Extension authenticates with the same cookies via `chrome.identity`-less flow: it opens the portal login if 401; cookies on `APP_URL` are sent from the extension's fetches (host_permissions). Provide `GET /api/me` as the auth check.

---

## 8. Build order — milestones with Definition of Done

> Claude Code: complete milestones in order; run the checks; commit per milestone.

**M0 — Scaffold & infra (foundation for everything)**
- Monorepo, docker-compose (Postgres+pgvector, Redis, MinIO), Prisma schema §5 migrated, seed script (1 demo user, 2 demo READY sessions incl. one Bangla), `.env.example`, README run instructions.
- ✅ DoD: `docker compose up` + `pnpm dev` boots web on :3000; `pnpm db:seed` works; `pnpm test` green (placeholder).

**M1 — Auth & shell (`INIT-01/02`, `MVP-28`)**
- OTP request/verify (console SMS), JWT cookies, refresh, logout; protected portal layout with top nav (Dashboard, Sessions, Search, Billing, Settings); responsive; locale toggle persists (UI strings via a tiny i18n dict — full Bangla copy can be filled later, scaffold now per `INIT-03`).
- ✅ DoD: e2e (Playwright): sign up by phone → land on dashboard → refresh keeps session → logout.

**M2 — Upload → transcribe → session ready (`MVP-35`, STT spine)**
- Upload URL flow, ingest with quota check, worker `transcribe` job (download from S3 → SttProvider → segments saved → status transitions UPLOADED→TRANSCRIBING→SUMMARIZING→READY), privateMode deletes audio object post-transcription (`INIT-18`), failure path sets FAILED with retry button.
- ✅ DoD: with `STT_PROVIDER=mock`, uploading the fixture file yields a READY session with segments; unit tests for quota math; status visible live (poll or SSE).

**M3 — AI pipeline (`MVP-01/02/04/07`)**
- Worker `summarize` job: summary (locale language), title, tags, action items persisted; tokens logged; regenerate endpoint.
- ✅ DoD: Bangla fixture produces Bangla summary fields (manual `pnpm eval:bangla` prints all three fixtures); zod parsing never throws unhandled.

**M4 — Library & session workspace (`MVP-29/30`, `MVP-06`, `MVP-05`, `INIT-16/17`)**
- Dashboard (recents), sessions list (filters, rename, delete), session page: audio player (wavesurfer) with click-to-seek synced transcript, summary panel, action items (check/edit), notes with optional timestamp anchor, status/processing states.
- ✅ DoD: e2e: open seeded session → play → click segment seeks → add note → toggle action item → rename session.

**M5 — Search & Ask (`MVP-08/09/10/11/31`)**
- FTS index + search page with highlights/filters; `index` worker job chunks transcript (≈800 chars, 100 overlap) + embeds into RagChunk; Ask panel on session page with SSE streaming and timestamp citations that seek the player.
- ✅ DoD: search finds Bangla and English seeded terms; Ask answers cite at least one segment; asking in Bangla answers in Bangla (manual check vs fixtures).

**M6 — Billing & quotas (`MVP-15/16/17-sandbox/19/32`)**
- Usage ledger writes on transcribe/ask; limits enforced; billing page (plan, usage meters, invoices); sandbox checkout + webhook → PRO; cancel; gated UX (friendly upgrade prompt on QUOTA_EXCEEDED).
- ✅ DoD: e2e: free user exceeds (lowered test cap) → blocked with upgrade prompt → sandbox pay → succeeds.

**M7 — Share, export, settings (`MVP-23/24/34`, `MVP-33`)**
- Share links (scope, expiry, revoke) + public page; PDF (Bangla font embedded) and DOCX export via worker; settings: profile, locale, default privateMode, data export JSON, delete account.
- ✅ DoD: exported PDF of the Bangla fixture renders Bangla correctly (visual check); share link opens logged-out; revoked link 404s.

**M8 — Chrome extension (`MVP-12/13`, `MVP-20` subset)**
- MV3 with: action button + side panel; capture current tab audio via `chrome.tabCapture` routed through an **offscreen document** recording with MediaRecorder (webm/opus); pause/stop; on stop, upload through the same `upload-url`/`ingest` API (source=EXTENSION, title defaults to tab title); side panel shows auth state, record controls, elapsed time, and after processing a link "Open in Doppio" deep-linking to the session page; recent sessions list in panel (reads `GET /api/sessions`).
- Constraints: if not logged in, open portal login tab; handle tab navigation/close mid-record by finalizing the recording; mic capture NOT in scope (tab audio only) — note for later.
- ✅ DoD: load unpacked → record a YouTube tab for 30s → stop → session appears in portal and becomes READY (mock STT in dev); panel deep-link opens it.

**M9 — Hardening pass**
- Rate limits (auth, ask), input limits, S3 lifecycle for FAILED orphans, error boundaries, empty states, loading skeletons, basic logging (pino) + request IDs; README finalized; `pnpm test` + `pnpm e2e` green.
- ✅ DoD: all prior e2e suites pass; lighthouse on dashboard ≥ 85 perf/accessibility locally.

---

## 9. Chrome extension — technical notes

- **Manifest:** `manifest_version: 3`; permissions: `tabCapture`, `offscreen`, `storage`, `sidePanel`; host_permissions: `${APP_URL}/*`.
- **Recording path:** action click → background SW calls `chrome.tabCapture.getMediaStreamId` → offscreen document `getUserMedia({audio: {mandatory: {chromeMediaSource:'tab', chromeMediaSourceId}}})` → MediaRecorder chunks to memory (cap ~2h) → on stop, single multipart upload via presigned URL.
- **Why batch, not live:** keeps v0 simple and matches §6 (no streaming STT yet). The side panel shows "Recording… will be transcribed when you stop." Leave `// TODO(stream)` markers.
- **Audio of the tab keeps playing** to the user: re-route the captured stream to an `AudioContext` destination in the offscreen doc so capture doesn't mute the tab.
- **Sync (`MVP-20` subset):** the extension holds no local DB; the backend is the source of truth; the panel re-fetches on focus.

---

## 10. UI map (web portal)

- `/login` — phone/email OTP, locale toggle, Doppio branding (logo wordmark text is fine; primary color `#0F4C5C`, accent `#C8881A`).
- `/dashboard` — usage meter, recents, "Upload audio" and "Import text" CTAs, install-extension callout.
- `/sessions` — table/cards: title, date, duration, status chip, tags; search box; row actions (rename/delete/share/export).
- `/sessions/[id]` — header (title editable, tags, status), left: player + transcript (auto-scroll, click-to-seek, segment highlight), right tabs: Summary (+regenerate) / Action items / Notes / Ask (chat with citations).
- `/search` — query + date filter, grouped results with highlighted snippets linking into sessions at timestamp.
- `/billing` — plan card, usage bars, upgrade CTA → sandbox checkout, invoice list, cancel.
- `/settings` — profile, language, default private mode, data export, danger zone (delete account).
- `/share/[token]` — public read-only summary (and transcript if scope=full), Doppio footer.
- All states: empty/loading/error designed, Bangla-ready strings via the i18n dict.

---

## 11. Testing & quality bars

- Unit (vitest): quota math, zod parsers for LLM outputs (incl. malformed-output recovery), OTP flow, share-token scoping, STT mock pipeline.
- E2E (Playwright): the five flows in M1/M4/M6/M7/M8 DoDs.
- **Bangla fixtures are mandatory:** every AI feature test runs against Bangla, English, and code-switched fixtures (`MVP-27` spirit). If summary output for the Bangla fixture comes back in English, that is a failing condition.
- Security basics: ownership checks on every `:id` route (test cross-user 403), httpOnly cookies, no JWT in localStorage, presigned URLs expire ≤ 10 min.

---

## 12. Explicitly deferred (do not build, leave seams)

| Deferred | Seam to leave |
|---|---|
| Real bKash/Nagad (`MVP-17/18`) | `PaymentProvider` interface + webhook shape already real |
| Own/fine-tuned Bangla STT (`INIT-10/11/13` full) | `SttProvider` interface; provider env switch |
| Streaming live transcript (`INIT-14` live) | `// TODO(stream)` in worker + extension |
| Mobile apps (`MVP-21` etc.) | API is already mobile-agnostic |
| WhatsApp share-sheet import (`MVP-36`) | upload API reusable |
| Cross-session RAG (`V1-05/06`) | RagChunk schema already global-queryable |
| Workspaces/teams (`V1-11+`) | keep userId scoping clean |
| Offline / data-light (`MVP-25/26`) | n/a for web v0 |

---

## 13. Definition of overall done (hand-back checklist)

- [ ] `docker compose up` + `pnpm dev` gives a working portal at `localhost:3000` with seeded demo data.
- [ ] Full happy path works with real keys: sign in → upload Bangla audio → READY session with Bangla summary, action items, tags → search finds it → Ask answers with citations → share link → PDF export renders Bangla → sandbox upgrade to PRO lifts quota.
- [ ] Extension (unpacked) records a tab and the session appears in the portal.
- [ ] All tests green; README documents setup, env, provider switching, and the deferred-seams table.

---

*Traceability: this plan implements the web+extension subset of Doppio Feature Matrix v1.0 / PRD v1.0. Matrix IDs are authoritative; if this document and the matrix conflict, the matrix wins and this plan should be updated.*
