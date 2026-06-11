# Doppio

*Your second self — a Bangla-first AI second brain that listens, remembers, and acts.*

Capture or upload audio → Bangla/English transcription (incl. Bangla–English code-switch) → AI summary, action items, searchable memory, and Ask-style Q&A. Web portal + Chrome extension, built to run **entirely on free tiers** (Vercel Hobby + Supabase free) with TwinMind/OpenAI behind swappable provider interfaces.

> Planning docs live in [docs/](docs/) — the feature matrix is the source of truth; requirement IDs (`MVP-28` etc.) trace back to it.

## Stack

| Layer | Choice |
|---|---|
| Web app | Next.js 15 (App Router) + TypeScript, Tailwind, TanStack Query |
| Monorepo | pnpm workspaces + Turborepo |
| DB | Supabase Postgres + pgvector (via Prisma) |
| Auth | Supabase Auth — email magic-link/OTP (phone OTP is a later seam) |
| Storage | Supabase Storage (private `doppio-audio` bucket) |
| STT | TwinMind Ear-3 (primary) · OpenAI (fallback) · mock (dev) — `packages/stt` |
| LLM + embeddings | OpenAI `gpt-4o-mini` + `text-embedding-3-small` · mock (dev) — `packages/ai` |
| Pipeline | Inline in a `maxDuration=300` route (no worker; queue is a seam) |
| Extension | Chrome MV3, Vite + CRXJS (M8) |
| Tests | Vitest (unit) + Playwright (e2e) |

## Workspace layout

```
apps/web         Next.js portal (UI + API route handlers + inline pipeline)
apps/extension   Chrome MV3 extension (wired up in M8)
packages/core    Shared constants (plan limits, budget guard), types, zod schemas
packages/db      Prisma schema + migrations + seed
packages/stt     SttProvider interface + twinmind/openai/mock adapters
packages/ai      LLMClient + prompt templates + zod output parsers
```

## Setup

1. **Prereqs:** Node ≥ 20, pnpm 9 (`npm i -g pnpm@9`).
2. **Supabase:** create a free project at [database.new](https://database.new), then:
   - Storage → create **private** bucket `doppio-audio`
   - Project Settings → Database → copy the **pooled** (port 6543) and **direct** (port 5432) connection strings
   - Project Settings → API → copy URL, anon key, service-role key
3. **Env:** `cp .env.example .env` and fill it in. Keep `STT_PROVIDER=mock` and `LLM_PROVIDER=mock` for development — dev loops cost $0.
4. **Install & migrate:**

```bash
pnpm install
pnpm db:migrate     # applies migrations (incl. pgvector) via DIRECT_URL
pnpm db:seed        # demo profile + 2 sessions (one Bangla)
pnpm dev            # portal on http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the web portal (Turbo → `@doppio/web`) |
| `pnpm build` | Build all packages/apps |
| `pnpm test` | Vitest across packages |
| `pnpm db:migrate` / `db:seed` / `db:generate` | Prisma deploy / seed / client generate |
| `pnpm eval:bangla` | Manual MVP-27 check against the **real** LLM (the only sanctioned dev spend) |

## Provider switching

Everything real-money sits behind interfaces, selected by env:

- `STT_PROVIDER=mock | twinmind | openai` — TwinMind ($0.23/hr, native code-switch + diarization) is primary; OpenAI (≤25MB files) is fallback.
- `LLM_PROVIDER=mock | openai`
- `PAYMENT_PROVIDER=sandbox` — sandbox checkout mimics the real bKash webhook shape.

**Budget guards:** per-user plan quotas (free: 120 min/mo) plus a global `MAX_TRANSCRIBE_MINUTES_TOTAL` kill-switch that protects the real credits no matter what.

## Free-tier notes

- Supabase free projects **pause after ~7 days idle** — they wake on the next request (a daily Vercel cron pinging `/api/health` keeps it warm).
- Vercel Hobby functions cap at **300s** — fine for short clips; long audio is a queue seam.
- Supabase built-in auth email has low send limits — swap in free SMTP (e.g. Resend) when needed.

## Deferred seams

| Deferred | Seam to leave |
|---|---|
| Phone OTP (`INIT-01`) | Supabase phone provider + paid SMS; UI already passwordless |
| Real bKash/Nagad (`MVP-17/18`) | `PaymentProvider` interface; webhook shape already real |
| Streaming / long audio | `// TODO(queue)` in pipeline; chunked upload |
| Own Bangla STT (`INIT-10/11/13`) | `SttProvider` interface + env switch |
| Diarization UI (`V1-14`) | `TranscriptSegment.speaker` already stored from TwinMind |
| Mobile apps (`MVP-21`) | API is client-agnostic |
| Workspaces/teams (`V1-11+`) | strict `userId` scoping everywhere |
