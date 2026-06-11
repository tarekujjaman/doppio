# Doppio — Product Requirements Document

*Your second self — an AI double that listens, remembers, and acts.*

| | |
|---|---|
| **Product** | Doppio |
| **Document** | Product Requirements Document (whole product, all phases) |
| **Version** | 1.0 |
| **Status** | Draft for review |
| **Date** | 11 June 2026 |
| **Source of truth** | `Doppio_Feature_Matrix.xlsx` (118 tasks, locked v1.0) |
| **Scope** | Initial · MVP · V1 · V2 · V3 — 118 requirements |

> This PRD is generated from, and traceable to, the locked feature matrix. Every requirement carries its task ID (e.g. `MVP-10`), so the document and the backlog stay in lockstep. Phase narratives, principles, and non-functional sections are authored on top of that spine.

---

## Contents

1. Executive summary
2. Problem & opportunity
3. Goals & non-goals
4. Target users
5. Product principles
6. Competitive landscape & differentiation
7. Surfaces & system architecture
8. Phased roadmap (overview)
9. Detailed requirements by phase
10. Key product flows
11. Non-functional requirements
12. Monetization & pricing
13. Privacy, security & compliance
14. Success metrics (KPIs)
15. Dependencies & critical path
16. Risks & mitigations
17. Open decisions
18. Glossary
19. Appendix — requirement traceability index

---

## 1. Executive summary

Doppio is an AI **second self** built for Bangladesh. It listens to meetings, lectures, consultations, and conversations; transcribes them **Bangla-first** (including the Bangla–English code-switching that real professional speech actually uses); remembers everything in a searchable memory; and — increasingly — acts on what it hears.

The wedge is simple. Global AI note-takers (TwinMind, Otter and similar) are strong in English, weak in Bangla, priced out of reach for most Bangladeshis (~$10–12/month), and assume credit cards and reliable connectivity. Doppio inverts every one of those assumptions: Bangla quality as a Day-1 release gate, a Pro tier at **Tk 200–300/month**, payment via **bKash / Nagad / Rocket**, and an offline-/low-bandwidth-aware, mobile-first build.

The product is delivered across three surfaces — a **web portal** (the hub where users manage and use everything), **mobile apps** (capture on the go), and a **Chrome extension** (quick on/off capture for browser meetings) — kept in sync as one product.

The roadmap moves from a de-risked foundation to a monetizable MVP, then to a daily-driver, then to scale, and finally to a set of **North-Star differentiators** — Bangla dialects and live interpretation, a Bangla voice agent, agentic auto-actions, and always-on ambient capture with context super-modes (including a healthcare mode that turns a consultation into a structured note and prescription). Together these form a moat that is hard to copy from outside Bangladesh.

## 2. Problem & opportunity

**The gap.** Knowledge work in Bangladesh runs on conversation — OPD consultations, coaching-centre lectures, NGO field meetings, newsroom interviews, SME stand-ups — and almost none of it is captured into durable, searchable knowledge. The tools that do this well are built for English and for Western buyers.

**Why incumbents don't fit:**

- **Language.** Bangla transcription is weak-to-absent, and real speech mixes Bangla and English mid-sentence; English-first engines drop exactly the technical terms that matter.
- **Price.** ~$10–12/month is a non-starter for students and most professionals here.
- **Payments.** No-card population; mobile financial services (bKash/Nagad/Rocket) are how people actually pay.
- **Connectivity & devices.** Android-heavy, data-conscious, patchy networks — global apps assume the opposite.

**The opportunity.** A Bangla-first, affordable, mobile-first second brain can own a market the incumbents are structurally poor at serving — and the same Bangla-language and ambient/agentic depth that wins locally is the hardest thing for a global player to replicate.

## 3. Goals & non-goals

**Goals**

- Capture spoken knowledge with **Bangla quality high enough to trust** (a measured release gate, not a hope).
- Turn every session into useful output — summary, action items, answerable memory — in Bangla and English.
- Be **affordable and payable** for Bangladesh (Tk 200–300/mo, MFS).
- Work across **web, mobile, and Chrome** as one synced product.
- Evolve from a note-taker into an **ambient, agentic second brain** with defensible local moats.

**Non-goals (for now)**

- Not a real-time meeting *platform* (Zoom/Meet replacement) — Doppio rides on top of meetings, it doesn't host them.
- Not a general project-management or task suite — it feeds tasks out (V3 agentic), it isn't a Jira.
- English-only polish is **not** a launch priority; Bangla parity is.
- Hardware (a dedicated wearable) is out of scope; Doppio supports BT mics/wearables (V3-20) rather than building one.

## 4. Target users

Doppio is described along two axes. The **persona** is the *actor* in each requirement; the **target user** is the *audience segment* it serves.

**Personas (actors)**

- **User** — end-user actions: recording, viewing, searching, sharing, paying.
- **System** — automated/AI/background behaviour with no human trigger: transcription, summaries, sync, suggestions, ambient capture.
- **Admin** — management and org-level controls: team billing, analytics, access, compliance.

**Audience segments**

- **Student** — lectures, study guides, exam prep; price-sensitive; coaching-centre culture.
- **Professional / team** — meetings, action items, collaboration; SMEs and remote teams.
- **Doctor / healthcare** — consultations, clinical notes, EMR synergy; highest trust/privacy bar.
- **Journalist / creator** — interviews, quotes, multi-source research and recall.

## 5. Product principles

1. **Bangla is the foundation, not a feature.** Bangla and code-switch STT are built in Phase 0 and gated on measured quality before anything ships on top.
2. **Speed and output quality win retention — not flashy AI.** The reason a user stays is that capture-to-useful-output is fast and good; AI sophistication is a means, not the pitch.
3. **Trust is the product, especially when always-on.** Privacy guardrails for ambient capture and sensitive (clinical) use are non-negotiable and ship *with* the feature, not after.
4. **Affordable by design.** Every decision is checked against the Tk 200–300 reality and MFS payment, not a Western price point.
5. **Ambient is the horizontal super-power.** Rather than building separate industry apps, Doppio captures everything and applies a context *lens* (healthcare, education) on top.
6. **One product, three surfaces.** Capture anywhere; manage everything in the portal; never let the surfaces feel like separate apps.
7. **Clinical fidelity for the healthcare lens.** Structured notes and prescriptions must serve clinical decision-making and export cleanly to EMR/Niramoy.

## 6. Competitive landscape & differentiation

**Reference points.** TwinMind and Otter define the category (live transcription, AI notes, searchable memory, Ask). They are the bar for *capability* and the foil for *positioning*.

**Doppio's differentiation:**

- **Bangla-language depth** — code-switch at launch; regional dialects and live Bangla↔English interpretation in V3. The hardest moat to copy from outside the market.
- **Local distribution & affordability** — MFS payments, low-bandwidth/offline modes, WhatsApp-native sharing, mobile-first.
- **Ambient + agentic** — from passive notes to an always-on memory that *acts* (follow-ups, scheduling, automation).
- **Vertical synergy** — the healthcare ambient mode (consult → SOAP + Rx → EMR/Niramoy export) leverages existing clinical product depth few competitors have.

## 7. Surfaces & system architecture

**Surfaces**

- **Web portal** — the central hub: library, session workspace, search & Ask, billing, settings, team admin. Where users *manage and use* Doppio.
- **Mobile apps (Android & iOS)** — capture on the go plus full access; Android-first given the market.
- **Chrome extension** — quick on/off capture for any browser meeting; deep-links into the portal.

**Build layers (components)**

- **ML-STT** — Bangla speech-to-text models and inference (the core moat and cost centre).
- **AI-LLM** — summaries, Q&A, content generation, agentic reasoning.
- **ML** — embeddings (Bangla vector index), diarization, TTS, other models.
- **Backend** — APIs, cross-surface sync, billing/entitlements, search index.
- **Payments** — bKash / Nagad / Rocket and card gateways.
- **Infra** — cloud, CI/CD, hosting, monitoring; later data residency.
- **Design** — UX, copy, and Bangla localization review.

**Data spine.** Captured sessions, uploaded audio, and imported documents all land in **one memory**. The vector index, deep search, and the V3 life-log treat every source as first-class — no silos.

## 8. Phased roadmap (overview)

| Phase | Theme | Requirements | P0 |
|---|---|---|---|
| **Initial** | Foundation & Core-Tech Proof | 21 | 15 |
| **MVP** | First Public, Monetizable Product | 37 | 18 |
| **V1** | Daily Driver | 21 | 0 |
| **V2** | Scale & Intelligence | 14 | 0 |
| **V3** | North-Star (Game-Changers) | 25 | 1 |
| **Total** | | **118** | **34** |

Phases are sequential in intent but dependency-linked in practice — several V3 items build on Phase 0/MVP foundations (see §15).

## 9. Detailed requirements by phase

Each requirement lists its user story, acceptance criteria (definition of done), and metadata. IDs match the locked matrix exactly.

### Phase 0 — Initial · Foundation & Core-Tech Proof

**Status:** Private alpha (internal only)  ·  **Requirements:** 21

**Phase goal.** De-risk the single hardest bet — Bangla speech-to-text — and stand up the core capture → transcribe → store loop on a secure backend, with privacy guarantees from the very first build.

**Exit criteria:**

- Bangla STT passes the **INIT-21 quality gate** (defined WER + summary-quality thresholds) on a curated Bangla and Bangla–English code-switch test set.
- Mobile capture works reliably, including background and low-battery recording (12h+ target).
- Live transcript renders within latency target; sessions persist in encrypted on-device storage with a working session list.
- Auth/identity, API gateway, and CI/CD + monitoring are live across staging and production.
- Private-mode (no-audio-retention) transcription path is proven for sensitive use.

#### Onboarding & Account  *( 5 requirements )*

##### `INIT-01` Phone / Email OTP sign-up — Phone + OTP auth flow

*As a user, I want to sign up with my phone number and an OTP so I can start without a card.*

**Acceptance criteria**
- SMS OTP delivered <30s
- resend & retry
- session token issued
- invalid/expired OTP handled.

**Persona:** User  ·  **Target:** All  ·  **Component:** Backend, Mobile  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** —

##### `INIT-02` Phone / Email OTP sign-up — Email sign-up fallback

*As a user, I want an email option in case SMS fails.*

**Acceptance criteria**
- Email + verification link
- duplicate-account prevention
- merges to one identity.

**Persona:** User  ·  **Target:** All  ·  **Component:** Backend, Mobile  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** INIT-01

##### `INIT-03` Bangla / English UI toggle — i18n localization framework

*As a user, I want the interface in Bangla so I can navigate comfortably.*

**Acceptance criteria**
- All strings externalized
- language switch persists
- Bangla webfont renders on all devices.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile, Chrome  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** —

##### `INIT-04` Bangla / English UI toggle — Bangla translation pass

*As a user, I want correct, natural Bangla copy.*

**Acceptance criteria**
- 100% of MVP screens translated and reviewed by a native speaker.

**Persona:** User  ·  **Target:** All  ·  **Component:** Design  ·  **Priority:** P0  ·  **Effort:** S  ·  **Depends on:** INIT-03

##### `INIT-05` Guided first-run walkthrough — Onboarding + permission primers

*As a user, I want a short walkthrough so I know how to record and read notes.*

**Acceptance criteria**
- Mic-permission primer
- 3–4 skippable slides
- shown once
- re-openable from settings.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** INIT-03

#### Audio Capture  *( 4 requirements )*

##### `INIT-06` In-person mobile recording — Mic capture + recording controls

*As a user, I want to record a live lecture or conversation on my phone.*

**Acceptance criteria**
- Start/stop
- live level meter
- handles incoming-call interruption
- autosave on crash.

**Persona:** User  ·  **Target:** Student, Doctor  ·  **Component:** Mobile  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** —

##### `INIT-07` In-person mobile recording — Audio chunking pipeline

*As the system, I want audio chunked for streaming transcription.*

**Acceptance criteria**
- Gapless chunks
- ordered upload/queue
- resilient to network drop.

**Persona:** System  ·  **Target:** All  ·  **Component:** Mobile, Backend  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** INIT-06

##### `INIT-08` Background + low-battery recording — Background recording service

*As the system, I want recording to continue in the background efficiently.*

**Acceptance criteria**
- Continues screen-off/backgrounded
- survives 12h
- battery drain within target/hr.

**Persona:** System  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** INIT-06

##### `INIT-09` Pause / resume recording — Pause/resume control + state

*As a user, I want to pause to skip private moments.*

**Acceptance criteria**
- Paused audio excluded
- seamless resume
- clear paused indicator.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** INIT-06

#### Transcription (Core)  *( 6 requirements )*

##### `INIT-10` Bangla speech-to-text engine — STT approach eval (build vs API)

*As the system, I want the best Bangla STT path chosen on evidence.*

**Acceptance criteria**
- Benchmark WER on Bangla test set
- build-vs-API decision
- unit-cost model documented.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT  ·  **Priority:** P0  ·  **Effort:** XL  ·  **Depends on:** —

##### `INIT-11` Bangla speech-to-text engine — Bangla STT inference service

*As a user, I want my Bangla speech transcribed accurately.*

**Acceptance criteria**
- Streaming + batch modes
- <2x real-time
- WER target met
- horizontally scalable.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT, Backend  ·  **Priority:** P0  ·  **Effort:** XL  ·  **Depends on:** INIT-10

##### `INIT-12` Bangla speech-to-text engine — Dialect, punctuation & numerals

*As the system, I want common accents and formatting handled.*

**Acceptance criteria**
- Common regional accents handled
- auto-punctuation
- Bangla numerals & dates.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** INIT-11

##### `INIT-13` Bangla–English code-switch — Code-switch language model

*As the system, I want mixed Bangla-English speech transcribed correctly.*

**Acceptance criteria**
- Mixed utterances transcribed
- English technical terms preserved
- consistent script.

**Persona:** System  ·  **Target:** Professional, Doctor  ·  **Component:** ML-STT  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** INIT-11

##### `INIT-21` Bangla quality gate — Bangla quality benchmark & release gate

*As the system, I want Bangla quality measured against a fixed bar so it ships only when it is genuinely good.*

**Acceptance criteria**
- Curated Bangla + code-switch test set
- WER & summary-quality thresholds defined as a release gate
- tracked every build.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT, AI-LLM  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** INIT-11, INIT-13

##### `INIT-14` Live transcript view — Real-time transcript UI

*As a user, I want to see the transcript appear live to confirm capture.*

**Acceptance criteria**
- Latency <1.5s
- partial→final tokens
- auto-scroll
- timestamps.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** INIT-11

#### Data & Storage  *( 3 requirements )*

##### `INIT-15` Local-first storage — On-device encrypted store

*As the system, I want recordings stored on-device by default.*

**Acceptance criteria**
- Encrypted at rest
- survives restart
- storage-quota management & cleanup.

**Persona:** System  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** —

##### `INIT-16` Recording / session list — Session list + detail screen

*As a user, I want a list of past recordings so I can find them later.*

**Acceptance criteria**
- Sorted by date
- title search
- opens to transcript/notes/summary.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** INIT-15

##### `INIT-17` Recording / session list — Delete / rename session

*As a user, I want to rename or delete sessions.*

**Acceptance criteria**
- Delete with confirm
- rename persists
- reflected in search.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** INIT-16

#### Privacy & Security  *( 1 requirement )*

##### `INIT-18` On-device transcription (no audio retention) — Private mode

*As the system, I want audio discarded after transcription for sensitive use.*

**Acceptance criteria**
- Toggle
- audio never uploaded
- only transcript stored
- clearly indicated in UI.

**Persona:** System  ·  **Target:** Doctor  ·  **Component:** Mobile, ML-STT  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** INIT-11, INIT-15

#### Platform Foundation  *( 2 requirements )*

##### `INIT-19` Core backend — Auth / identity + API gateway

*As the system, I want a secure backend foundation.*

**Acceptance criteria**
- JWT auth
- rate limiting
- versioned secure endpoints
- secrets management.

**Persona:** System  ·  **Target:** All  ·  **Component:** Backend, Infra  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** —

##### `INIT-20` Core infra — CI/CD, environments, monitoring

*As the system, I want reliable deploy & observability.*

**Acceptance criteria**
- Staging + prod
- deploy pipeline
- centralized logging, metrics & alerting.

**Persona:** System  ·  **Target:** All  ·  **Component:** Infra  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** —

### Phase 1 — MVP · First Public, Monetizable Product

**Status:** Public launch (v1.0)  ·  **Requirements:** 37

**Phase goal.** Deliver a usable end-to-end second brain across all three surfaces — web portal, mobile, and Chrome extension — with AI summaries, action items, search, Ask Doppio, payments, cross-surface sync, sharing, and import. This is the first revenue-capable release.

**Exit criteria:**

- A user can capture (mobile/Chrome) **or upload** audio and receive a Bangla/English summary plus extracted action items.
- A user can search and Ask across their sessions, and everything is reachable from the **web portal**.
- A user can subscribe and pay via **bKash / Nagad / Rocket**, and manage the plan in-app and on web.
- Sessions sync across web, mobile, and Chrome.
- **MVP-27 Bangla AI-quality validation** passes — summaries, action items, and Q&A proven on real Bangla and code-switched input.

#### AI Notes & Summaries  *( 7 requirements )*

##### `MVP-01` Auto session summary — Summarization pipeline

*As the system, I want a summary generated after each session.*

**Acceptance criteria**
- Summary within target time
- sections (overview/decisions/next steps)
- Bangla & English.

**Persona:** System  ·  **Target:** Professional, Doctor  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** INIT-11

##### `MVP-02` Auto session summary — Prompt + output templates

*As the system, I want consistent, cost-tracked summary structure.*

**Acceptance criteria**
- Standard template
- token cost logged
- configurable length.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-01

##### `MVP-03` Auto session summary — Summary view + regenerate

*As a user, I want to read, copy and regenerate the summary.*

**Acceptance criteria**
- View
- regenerate
- copy-to-clipboard
- loading & error states.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile, Chrome  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** MVP-01

##### `MVP-04` Action item extraction — To-do extraction

*As the system, I want action items pulled automatically.*

**Acceptance criteria**
- Items with owner/date where stated
- editable
- deduped.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** AI-LLM  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-01

##### `MVP-05` Action item extraction — To-do management UI

*As a user, I want to manage extracted tasks.*

**Acceptance criteria**
- Check off
- edit
- aggregated tasks view across sessions.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-04

##### `MVP-06` Editable notes — Inline note editor

*As a user, I want to add my own notes alongside the transcript.*

**Acceptance criteria**
- Add/edit during & after
- autosave
- notes linked to timestamps.

**Persona:** User  ·  **Target:** Student  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** INIT-14

##### `MVP-07` Auto title & tagging — Auto-title + topic tags

*As the system, I want sessions auto-titled and tagged.*

**Acceptance criteria**
- Title generated
- 3–5 tags
- user-editable
- used in search.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** MVP-01

#### Memory & Search  *( 4 requirements )*

##### `MVP-08` Keyword search — Full-text search index

*As a user, I want to search all my notes by keyword.*

**Acceptance criteria**
- Indexes transcript+notes+title
- Bangla tokenization
- ranked results.

**Persona:** User  ·  **Target:** Journalist  ·  **Component:** Backend  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** INIT-16

##### `MVP-09` Keyword search — Search UI + filters

*As a user, I want to filter and see matches highlighted.*

**Acceptance criteria**
- Query box
- date/type filters
- match highlighting.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile, Chrome  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** MVP-08

##### `MVP-10` Ask Doppio — RAG over single session

*As a user, I want to ask questions about a meeting.*

**Acceptance criteria**
- Grounded answer
- cites timestamps
- Bangla & English Q&A.

**Persona:** User  ·  **Target:** All  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** MVP-01

##### `MVP-11` Ask Doppio — Chat UI

*As a user, I want a conversational way to query a session.*

**Acceptance criteria**
- Threaded chat
- follow-ups
- copy answer
- empty/error states.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile, Chrome  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-10

#### Capture Expansion  *( 3 requirements )*

##### `MVP-12` Chrome extension — Extension scaffold + tab audio capture

*As a user, I want to capture Zoom/Meet calls from my browser.*

**Acceptance criteria**
- Captures tab audio on Meet/Zoom web
- start/stop
- permission flow.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Chrome  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** INIT-07

##### `MVP-13` Chrome extension — Extension transcript/summary panel

*As a user, I want live transcript and summary in the browser.*

**Acceptance criteria**
- Side-panel live transcript
- summary after
- links to web app.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Chrome  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-12, MVP-01

##### `MVP-14` Quick voice note — One-tap voice memo

*As a user, I want quick voice memos transcribed.*

**Acceptance criteria**
- Record from home screen
- transcribed
- saved as a session.

**Persona:** User  ·  **Target:** Journalist  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** INIT-06

#### Monetization & Payments  *( 5 requirements )*

##### `MVP-15` Free tier — Usage metering + caps

*As the system, I want to meter usage and enforce free limits.*

**Acceptance criteria**
- Track minutes/AI calls
- enforce free cap
- show usage to user.

**Persona:** System  ·  **Target:** All  ·  **Component:** Backend  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** INIT-19

##### `MVP-16` Pro subscription — Plans + entitlements

*As the system, I want plans that gate features.*

**Acceptance criteria**
- Monthly ৳200–300
- entitlement gates
- grace period & expiry handling.

**Persona:** System  ·  **Target:** All  ·  **Component:** Backend  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-15

##### `MVP-17` bKash / Nagad / Rocket — bKash integration

*As a user, I want to pay with bKash since I have no card.*

**Acceptance criteria**
- Checkout
- webhook confirms payment
- renewal
- failure/refund handling.

**Persona:** User  ·  **Target:** All  ·  **Component:** Payments, Backend  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** MVP-16

##### `MVP-18` bKash / Nagad / Rocket — Nagad + Rocket integration

*As a user, I want more MFS payment options.*

**Acceptance criteria**
- Both gateways live
- unified receipt & reconciliation.

**Persona:** User  ·  **Target:** All  ·  **Component:** Payments, Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-17

##### `MVP-19` In-app subscription mgmt — Manage / cancel / upgrade

*As a user, I want to manage my plan in-app.*

**Acceptance criteria**
- See current plan
- upgrade/downgrade
- cancel
- invoice history.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-16

#### Sync & Platform  *( 3 requirements )*

##### `MVP-20` Cross-surface sync (web · mobile · Chrome) — Cloud sync service

*As the system, I want sessions synced across the web portal, mobile and the Chrome extension.*

**Acceptance criteria**
- Two-way sync across all surfaces
- conflict resolution
- offline queue & retry.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** INIT-15, INIT-19

##### `MVP-21` iOS app — iOS parity build

*As a user, I want the app on iPhone too.*

**Acceptance criteria**
- Capture/transcript/notes/summary parity
- background recording within iOS limits.

**Persona:** User  ·  **Target:** All  ·  **Component:** iOS  ·  **Priority:** P0  ·  **Effort:** XL  ·  **Depends on:** INIT-06, INIT-11, MVP-01

##### `MVP-22` Encrypted cloud backup — Optional encrypted backup

*As a user, I want optional backup so I don't lose notes.*

**Acceptance criteria**
- Opt-in
- encrypted
- restore on a new device.

**Persona:** User  ·  **Target:** All  ·  **Component:** Backend, Mobile  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-20

#### Sharing & Export  *( 2 requirements )*

##### `MVP-23` Share summary — Share to WhatsApp / link

*As a user, I want to share a summary via WhatsApp.*

**Acceptance criteria**
- Share as text or link
- link access control
- expiry option.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Mobile, Backend  ·  **Priority:** P0  ·  **Effort:** S  ·  **Depends on:** MVP-01

##### `MVP-24` Export PDF / Word — Export transcript + summary

*As a user, I want to export to share with others.*

**Acceptance criteria**
- PDF & DOCX
- Bangla font embedded
- includes notes & action items.

**Persona:** User  ·  **Target:** Journalist  ·  **Component:** Mobile, Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-01

#### Localization & Access  *( 2 requirements )*

##### `MVP-25` Data-light mode — Bandwidth optimization

*As the system, I want low data usage on mobile networks.*

**Acceptance criteria**
- Compressed uploads
- toggle
- usable on 2G/3G.

**Persona:** System  ·  **Target:** All  ·  **Component:** Mobile, Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-20

##### `MVP-26` Offline transcription — On-device offline STT model

*As the system, I want transcription to work offline.*

**Acceptance criteria**
- Smaller on-device model
- queues & syncs results when online.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT, Mobile  ·  **Priority:** P2  ·  **Effort:** XL  ·  **Depends on:** INIT-11

#### AI Quality  *( 1 requirement )*

##### `MVP-27` Bangla AI-quality validation — Validate summaries / action items / Q&A on Bangla

*As the system, I want the AI layer proven on Bangla, not just English.*

**Acceptance criteria**
- Summaries, action items & Q&A evaluated on real Bangla + code-switch sessions
- quality bar met before launch.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-01, MVP-04, MVP-10

#### Web Portal  *( 7 requirements )*

##### `MVP-28` Web app shell & auth — Responsive web portal + sign-in

*As a user, I want a web portal where I sign in and reach everything.*

**Acceptance criteria**
- Responsive layout
- OTP/email sign-in
- top nav (Home, Library, Search, Settings)
- session persistence.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web, Backend  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** INIT-19

##### `MVP-29` Session library — Web library & dashboard

*As a user, I want all my sessions in one place on the web.*

**Acceptance criteria**
- Lists & filters all sessions
- recents on the dashboard
- opens to a session.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-28, INIT-16

##### `MVP-30` Session workspace — Web transcript / summary / notes view

*As a user, I want to read, edit and play back a session in the portal.*

**Acceptance criteria**
- Transcript + summary + notes
- edit notes
- regenerate summary
- audio playback synced to transcript.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web  ·  **Priority:** P0  ·  **Effort:** L  ·  **Depends on:** MVP-28, MVP-01, MVP-06

##### `MVP-31` Search & Ask on web — Web search + Ask Doppio

*As a user, I want to search and ask questions about my sessions in the portal.*

**Acceptance criteria**
- Full-text search with filters
- Ask Doppio chat
- grounded answers with timestamps.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-08, MVP-10, MVP-28

##### `MVP-32` Account & billing — Web subscription & billing centre

*As a user, I want to manage my plan and payments on the web.*

**Acceptance criteria**
- View/upgrade/cancel plan
- bKash/Nagad/Rocket
- invoice history
- usage meter.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web, Payments  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** MVP-16, MVP-28

##### `MVP-33` Settings & privacy — Web settings & privacy controls

*As a user, I want to manage language, privacy and data from the portal.*

**Acceptance criteria**
- Language toggle
- private mode
- profile
- data export & account deletion.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-28

##### `MVP-34` Export & share — Web export & share

*As a user, I want to export and share sessions from the portal.*

**Acceptance criteria**
- Export PDF/DOCX
- share link or WhatsApp
- access controls on shared links.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** MVP-23, MVP-24, MVP-28

#### Import & Memory  *( 3 requirements )*

##### `MVP-35` File upload — Audio/video upload → transcribe & summarize

*As a user, I want to upload existing recordings and have them transcribed into memory.*

**Acceptance criteria**
- Accepts mp3/wav/m4a/mp4
- runs standard pipeline
- counts against usage
- progress + error states.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web, Mobile, Backend, ML-STT  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** INIT-11, MVP-01, MVP-15

##### `MVP-36` Share-to-Doppio — WhatsApp / share-sheet voice-note import

*As a user, I want to forward a voice note straight into Doppio.*

**Acceptance criteria**
- Appears in OS share sheet
- imports audio
- becomes a session.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P1  ·  **Effort:** S  ·  **Depends on:** MVP-35

##### `MVP-37` Text import — Transcript / text-note import

*As a user, I want to bring in an existing transcript or notes as a session.*

**Acceptance criteria**
- Paste or upload text
- stored & indexed as a session.

**Persona:** User  ·  **Target:** Journalist  ·  **Component:** Web, Backend  ·  **Priority:** P2  ·  **Effort:** S  ·  **Depends on:** INIT-16

### Phase 2 — V1 · Daily Driver

**Status:** Post-launch growth  ·  **Requirements:** 21

**Phase goal.** Make Doppio the tool people open every day: content generation, deep cross-session memory, calendar/meeting integrations, collaboration and team plans, and document import into the knowledge base.

**Exit criteria:**

- Deep search and Ask span **all** of a user's sessions (cross-session RAG over a Bangla vector index).
- Calendar sync and a meeting bot (Zoom/Meet/Teams) are live.
- Shared workspaces with roles, plus web-first workspace administration.
- Document, bulk/folder, and link import are indexed into the same memory as recorded sessions.
- Team/SME plans are billable; student discount tier available.

#### Content Generation  *( 4 requirements )*

##### `V1-01` Generate docs — Content-generation engine

*As a user, I want documents generated from my notes.*

**Acceptance criteria**
- Pick template
- generate from session
- edit & export
- Bangla/English.

**Persona:** User  ·  **Target:** Student  ·  **Component:** AI-LLM  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-01

##### `V1-02` Generate docs — Study guide / email / MoM formats

*As a user, I want ready-made formats for my use cases.*

**Acceptance criteria**
- Study guide, follow-up email, minutes formats
- editable.

**Persona:** User  ·  **Target:** Student, Professional  ·  **Component:** AI-LLM  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** V1-01

##### `V1-03` Domain templates — SOAP / minutes / interview templates

*As a user, I want structured output for my field.*

**Acceptance criteria**
- Domain-specific structure (e.g. doctor SOAP)
- editable
- saved presets.

**Persona:** User  ·  **Target:** Doctor  ·  **Component:** AI-LLM  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** V1-01

##### `V1-04` Auto-translate — Bangla ↔ English translation

*As the system, I want summaries/transcripts translated.*

**Acceptance criteria**
- Toggle language
- acceptable quality
- preserves key terms.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** AI-LLM  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-01

#### Deep Memory  *( 3 requirements )*

##### `V1-05` Deep search across meetings — Cross-session RAG

*As a user, I want to ask questions across all meetings.*

**Acceptance criteria**
- Answers span sessions
- cite source meeting
- Bangla & English.

**Persona:** User  ·  **Target:** All  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** MVP-10

##### `V1-06` Deep search across meetings — Bangla vector index

*As the system, I want embeddings for Bangla retrieval.*

**Acceptance criteria**
- Bangla embeddings
- incremental indexing
- relevance tuned.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML, Backend  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** V1-05

##### `V1-07` Proactive suggestions — Live suggestion engine

*As the system, I want relevant context surfaced live.*

**Acceptance criteria**
- Surfaces related past context during a meeting
- opt-in
- low latency.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** MVP-10

#### Integrations  *( 3 requirements )*

##### `V1-08` Google Calendar sync — Calendar OAuth + event import

*As the system, I want meetings detected from the calendar.*

**Acceptance criteria**
- Connect Google
- auto-create sessions from events
- pre-meeting reminder.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** INIT-19

##### `V1-09` Meeting bot — Zoom/Meet/Teams join-bot

*As a user, I want a bot to join and record calls.*

**Acceptance criteria**
- Bot joins via link
- records
- posts transcript & summary back.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Backend, Infra  ·  **Priority:** P1  ·  **Effort:** XL  ·  **Depends on:** MVP-01

##### `V1-10` Gmail follow-up — Gmail send integration

*As a user, I want generated follow-ups ready in Gmail.*

**Acceptance criteria**
- Connect Gmail
- create draft or send generated follow-up.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V1-01

#### Collaboration  *( 4 requirements )*

##### `V1-11` Shared workspaces — Teams / workspaces + roles

*As a user, I want shared folders for my team.*

**Acceptance criteria**
- Create team
- invite members
- shared session folders
- permissions.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** MVP-20

##### `V1-12` Shared workspaces — Workspace UI

*As a user, I want to switch between personal and team spaces.*

**Acceptance criteria**
- Workspace switcher
- shared session list
- member visibility.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Mobile, Chrome  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** V1-11

##### `V1-13` Comments & highlights — Transcript annotation

*As a user, I want to highlight and comment on the transcript.*

**Acceptance criteria**
- Highlight text
- threaded comments
- @mention
- resolve.

**Persona:** User  ·  **Target:** Journalist  ·  **Component:** Mobile, Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V1-11

##### `V1-14` Speaker identification — Diarization pipeline

*As the system, I want to label who said what.*

**Acceptance criteria**
- Separates speakers
- rename labels
- works on Bangla audio.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML, Backend  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** INIT-11

#### Monetization  *( 2 requirements )*

##### `V1-15` Team / SME plans — Team billing + seats

*As an admin, I want a team plan with central billing.*

**Acceptance criteria**
- Per-seat pricing
- central invoice
- bKash/card
- add/remove seats.

**Persona:** Admin  ·  **Target:** Professional  ·  **Component:** Payments, Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-16, V1-11

##### `V1-16` Student discount — Student verification tier

*As a user, I want a discounted student plan.*

**Acceptance criteria**
- Verify student email/ID
- discounted plan applied
- periodic re-verify.

**Persona:** User  ·  **Target:** Student  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** S  ·  **Depends on:** MVP-16

#### Web Portal  *( 2 requirements )*

##### `V1-17` Workspace admin — Web workspace & member management

*As an admin, I want to manage my team, roles and shared folders from the portal.*

**Acceptance criteria**
- Invite/remove members
- assign roles
- manage shared folders
- web-first admin.

**Persona:** Admin  ·  **Target:** Professional  ·  **Component:** Web, Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** V1-11

##### `V1-18` Integrations hub — Web integrations management

*As a user, I want to connect and manage integrations from the portal.*

**Acceptance criteria**
- Connect/disconnect Calendar, Gmail & meeting bot
- show status & re-auth.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Web  ·  **Priority:** P2  ·  **Effort:** S  ·  **Depends on:** V1-08, V1-09, V1-10

#### Import & Memory  *( 3 requirements )*

##### `V1-19` Document to memory — Document upload (PDF/DOCX/image OCR)

*As a user, I want to add documents to memory so search & Ask can use them.*

**Acceptance criteria**
- PDF/DOCX/image OCR
- chunked & indexed
- appears in deep search & Ask Doppio.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web, Backend, AI-LLM, ML  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** V1-05, V1-06

##### `V1-20` Bulk import — Bulk / folder import & migration

*As a user, I want to import many files at once, incl. from other note apps.*

**Acceptance criteria**
- Multi-file upload
- maps other tools' exports
- batch status.

**Persona:** User  ·  **Target:** All  ·  **Component:** Web, Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** MVP-35

##### `V1-21` Link ingestion — Link / article ingestion

*As a user, I want to drop a URL/article into memory.*

**Acceptance criteria**
- Fetches & extracts article
- indexed for search & Ask.

**Persona:** User  ·  **Target:** Journalist  ·  **Component:** Web, Backend, AI-LLM  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V1-06

### Phase 3 — V2 · Scale & Intelligence

**Status:** Scale  ·  **Requirements:** 14

**Phase goal.** Add second-brain intelligence, advanced AI controls, vertical depth (healthcare and education), and enterprise/ecosystem readiness.

**Exit criteria:**

- Daily/weekly digests and cross-meeting insight detection.
- Multi-LLM selection and custom AI assistants; live translated captions.
- EMR-ready clinical note export and a Bangla/English medical lexicon.
- Admin dashboard, SSO + RBAC, data residency, and retention controls.
- Public API / webhooks and a referral program.

#### Second Brain  *( 2 requirements )*

##### `V2-01` Daily / weekly digest — Digest generation + delivery

*As the system, I want to compile a digest of meetings & tasks.*

**Acceptance criteria**
- Scheduled digest
- push/email
- Bangla
- user-set cadence.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V1-05

##### `V2-02` Cross-meeting insights — Theme / connection detection

*As the system, I want to connect themes across sessions.*

**Acceptance criteria**
- Surfaces recurring themes, people & open threads across meetings.

**Persona:** System  ·  **Target:** Journalist  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V1-05

#### Advanced AI  *( 3 requirements )*

##### `V2-03` Multi-LLM choice — Model selector + routing

*As a user, I want to choose the AI model.*

**Acceptance criteria**
- Choose Claude/GPT/Gemini
- per-task default
- relative cost shown.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** MVP-02

##### `V2-04` Custom AI assistants — Assistant / persona builder

*As a user, I want a domain-tuned assistant.*

**Acceptance criteria**
- Create assistant with custom instructions
- reuse across sessions.

**Persona:** User  ·  **Target:** Doctor  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V2-03

##### `V2-05` Live translated captions — Real-time translation overlay

*As the system, I want live translated captions.*

**Acceptance criteria**
- Live captions translated
- <2s latency
- bilingual meeting support.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM, ML  ·  **Priority:** P2  ·  **Effort:** XL  ·  **Depends on:** V1-04

#### Vertical – Healthcare  *( 2 requirements )*

##### `V2-06` EMR-ready clinical note export — Structured clinical export

*As a user, I want consult notes formatted for EMR import.*

**Acceptance criteria**
- Export to EMR/FHIR or Niramoy format
- field mapping
- validation.

**Persona:** User  ·  **Target:** Doctor  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V1-03

##### `V2-07` Medical dictionary — Bangla/English medical lexicon

*As the system, I want accurate medical-term transcription.*

**Acceptance criteria**
- Medical terms, drug names & abbreviations recognized
- custom lexicon.

**Persona:** System  ·  **Target:** Doctor  ·  **Component:** ML-STT  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** INIT-13

#### Vertical – Education  *( 1 requirement )*

##### `V2-08` Lecture → quiz / flashcards — Quiz / flashcard generator

*As a user, I want quizzes generated from lectures.*

**Acceptance criteria**
- Generate MCQ & flashcards from a lecture
- export/share.

**Persona:** User  ·  **Target:** Student  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V1-01

#### Enterprise & Admin  *( 4 requirements )*

##### `V2-09` Admin dashboard — Usage analytics dashboard

*As an admin, I want analytics across my team.*

**Acceptance criteria**
- Per-team usage, minutes, active users
- CSV export.

**Persona:** Admin  ·  **Target:** Professional  ·  **Component:** Backend, Web  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V1-15

##### `V2-10` SSO & RBAC — SSO + role-based access

*As an admin, I want SSO and access roles.*

**Acceptance criteria**
- SSO (Google/SAML)
- role-based permissions
- audit log.

**Persona:** Admin  ·  **Target:** Professional  ·  **Component:** Backend, Infra  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V1-11

##### `V2-11` Data residency — In-country hosting option

*As an admin, I want data stored in-country for compliance.*

**Acceptance criteria**
- Data stored in BD region
- compliance documentation provided.

**Persona:** Admin  ·  **Target:** Doctor  ·  **Component:** Infra  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** INIT-20

##### `V2-12` Retention policy — Configurable retention controls

*As an admin, I want to set retention & deletion rules.*

**Acceptance criteria**
- Set retention period
- auto-delete
- legal-hold override.

**Persona:** Admin  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** INIT-15

#### Ecosystem  *( 2 requirements )*

##### `V2-13` Public API / webhooks — Developer API + webhooks

*As an admin, I want API access to integrate Doppio.*

**Acceptance criteria**
- API keys
- docs
- webhook events
- per-key rate limits.

**Persona:** Admin  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** INIT-19

##### `V2-14` Referral program — Referral / affiliate system

*As a user, I want to refer friends for rewards.*

**Acceptance criteria**
- Referral codes
- reward credit
- attribution tracking.

**Persona:** User  ·  **Target:** All  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** MVP-16

### Phase 4 — V3 · North-Star (Game-Changers)

**Status:** Differentiation / moat  ·  **Requirements:** 25

**Phase goal.** Ship the defensible differentiators global tools cannot easily copy: Bangla dialect depth and live interpretation, a Bangla voice agent, agentic auto-actions, and always-on ambient capture with context-aware super-modes.

**Exit criteria:**

- Dialect-adaptive STT (Sylheti, Chittagonian, …) with auto-detection.
- Live two-way Bangla↔English interpretation and a Bangla voice agent with natural TTS.
- Agentic follow-ups, scheduling, and task/form automation — all approval-gated with an audit trail.
- Always-on ambient capture with **privacy guardrails (V3-19, P0)**, auto-segmentation, and context lenses including the **Healthcare ambient mode** (consult → SOAP + Rx → EMR export).

#### Lang Depth · Dialects  *( 3 requirements )*

##### `V3-01` Regional dialect STT — Dialect-adaptive Bangla models

*As a user, I want my regional dialect (Sylheti, Chittagonian, etc.) transcribed accurately.*

**Acceptance criteria**
- Major dialects detected & transcribed
- graceful fallback to standard Bangla
- per-dialect WER targets.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT  ·  **Priority:** P1  ·  **Effort:** XL  ·  **Depends on:** INIT-11, INIT-13

##### `V3-02` Regional dialect STT — Dialect auto-detection

*As the system, I want to detect the speaker's dialect and switch models automatically.*

**Acceptance criteria**
- Detects dialect within first utterances
- user override
- mixed-dialect handling.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML-STT  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V3-01

##### `V3-03` Vernacular normalization — Colloquial / numeral / date normalization

*As the system, I want colloquial Bangla normalized cleanly in notes.*

**Acceptance criteria**
- Local idioms, taka amounts, colloquial dates & numerals normalized in summaries.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** INIT-12

#### Lang Depth · Interpretation  *( 3 requirements )*

##### `V3-04` Live Bangla-English interpretation — Real-time two-way interpretation

*As a user, I want live spoken translation both ways so a foreign buyer and Bangla staff can talk.*

**Acceptance criteria**
- Two-way spoken translation
- <2s latency
- usable live
- handles code-switch.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM, ML  ·  **Priority:** P1  ·  **Effort:** XL  ·  **Depends on:** V1-04, V2-05

##### `V3-05` Live Bangla-English interpretation — Per-speaker translated captions

*As a user, I want each speaker's words shown in my chosen language.*

**Acceptance criteria**
- Per-speaker translated captions with labels
- toggle source/target language.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V3-04, V1-14

##### `V3-06` Live Bangla-English interpretation — Bilingual aligned transcript export

*As a user, I want a side-by-side bilingual transcript afterwards.*

**Acceptance criteria**
- Aligned Bangla/English transcript
- export to PDF & DOCX.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V3-04

#### Lang Depth · Voice Agent  *( 3 requirements )*

##### `V3-07` Bangla voice agent — Voice query — ask out loud in Bangla

*As a user, I want to ask my notes questions out loud in Bangla and hear the answer.*

**Acceptance criteria**
- Voice query in Bangla
- grounded answer as text + spoken
- conversational follow-ups.

**Persona:** User  ·  **Target:** All  ·  **Component:** AI-LLM, ML  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** V1-05

##### `V3-08` Bangla voice agent — Natural Bangla text-to-speech

*As the system, I want natural Bangla TTS for spoken answers & summaries.*

**Acceptance criteria**
- Natural Bangla TTS
- adjustable speed
- intelligible on low-end speakers.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V3-07

##### `V3-09` Bangla voice agent — Hands-free conversational mode

*As a user, I want hands-free voice access while driving or walking.*

**Acceptance criteria**
- Wake-word / hands-free invoke
- conversational follow-ups
- safe one-hand UX.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile, AI-LLM  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V3-07

#### Agentic · Follow-through  *( 4 requirements )*

##### `V3-10` Auto follow-up — Auto-draft & send follow-ups

*As a user, I want follow-up messages drafted and sent from meeting decisions.*

**Acceptance criteria**
- Drafts from decisions
- approve-then-send or auto-send via WhatsApp/email.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** V1-01, V1-10

##### `V3-11` Auto follow-up — Auto-schedule from decisions

*As the system, I want a meeting scheduled when the conversation agrees to one.*

**Acceptance criteria**
- Detects scheduling intent then creates a calendar event with attendees & reminders.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** V1-08

##### `V3-12` Task automation — Action-item to reminder/task automation

*As the system, I want extracted action items turned into tracked reminders.*

**Acceptance criteria**
- Tasks become reminders with due dates
- nudges
- sync to external task apps.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** Backend  ·  **Priority:** P1  ·  **Effort:** M  ·  **Depends on:** MVP-04, MVP-05

##### `V3-13` Document automation — Form & document auto-fill

*As a user, I want forms/reports auto-filled from a session.*

**Acceptance criteria**
- Populates a chosen template/form from session content
- user reviews before save.

**Persona:** User  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V1-03

#### Agentic · Orchestration  *( 3 requirements )*

##### `V3-14` Agentic workflows — Custom trigger-to-action recipes

*As a user, I want to automate 'if a meeting is tagged X, do Y'.*

**Acceptance criteria**
- Build & save automations
- template library
- enable/disable per workspace.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P2  ·  **Effort:** XL  ·  **Depends on:** V3-10, V3-12

##### `V3-15` Proactive prep — Pre-meeting briefing agent

*As the system, I want a brief prepared before each meeting.*

**Acceptance criteria**
- Before a calendar meeting, compiles a brief from related past sessions.

**Persona:** System  ·  **Target:** Professional  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V1-05, V1-08

##### `V3-16` Action approval — Multi-step execution with approval & audit

*As a user, I want to review and approve agent actions safely.*

**Acceptance criteria**
- Shows planned actions
- approve/deny
- full audit log of executed actions.

**Persona:** User  ·  **Target:** Professional  ·  **Component:** Backend, AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V3-10, V3-11

#### Ambient · Capture  *( 4 requirements )*

##### `V3-17` Always-on ambient capture — Continuous low-power ambient recording

*As a user, I want all-day passive capture so I never miss a conversation.*

**Acceptance criteria**
- All-day battery-safe capture
- auto-segmentation
- strict privacy guardrails.

**Persona:** System  ·  **Target:** All  ·  **Component:** Mobile, ML-STT  ·  **Priority:** P1  ·  **Effort:** XL  ·  **Depends on:** INIT-08, INIT-18

##### `V3-18` Always-on ambient capture — Auto conversation segmentation

*As the system, I want the ambient stream split into distinct titled sessions.*

**Acceptance criteria**
- Splits by speaker/topic/time-gap
- auto-titles
- merges fragments.

**Persona:** System  ·  **Target:** All  ·  **Component:** ML, AI-LLM  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** V3-17

##### `V3-19` Ambient privacy — Consent, mute-zones & retention controls

*As the system, I want strong privacy guardrails for always-on capture.*

**Acceptance criteria**
- Pause/mute zones
- on-device-only option
- consent prompts
- auto-purge rules.

**Persona:** System  ·  **Target:** All  ·  **Component:** Mobile, Backend  ·  **Priority:** P0  ·  **Effort:** M  ·  **Depends on:** V3-17, V2-12

##### `V3-20` Wearable support — BT mic / wearable integration

*As a user, I want to pair a wearable or BT mic for cleaner ambient audio.*

**Acceptance criteria**
- Pair external BT mic/wearable
- battery & connection status
- auto-failover to phone.

**Persona:** User  ·  **Target:** All  ·  **Component:** Mobile  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V3-17

#### Ambient · Super-Modes  *( 5 requirements )*

##### `V3-21` Context-aware modes — Auto context detection & lens switching

*As the system, I want the right template applied based on the situation.*

**Acceptance criteria**
- Detects lecture vs meeting vs consultation vs field-visit
- applies matching summary style.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P1  ·  **Effort:** L  ·  **Depends on:** MVP-07, V1-03

##### `V3-22` Healthcare ambient mode — Consultation lens to structured note + Rx (Niramoy)

*As a doctor, I want ambient consultation capture turned into a clinical note and prescription.*

**Acceptance criteria**
- Ambient consult to SOAP note + prescription draft to Niramoy/EMR export
- on-device privacy.

**Persona:** User  ·  **Target:** Doctor  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P1  ·  **Effort:** XL  ·  **Depends on:** V2-06, V2-07, V3-21

##### `V3-23` Education ambient mode — Lecture lens to notes + study pack

*As a student, I want ambient lecture capture turned into a Bangla study pack.*

**Acceptance criteria**
- Ambient lecture to Bangla notes + key terms + quiz/flashcards
- coaching-friendly export.

**Persona:** User  ·  **Target:** Student  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** L  ·  **Depends on:** V2-08, V3-21

##### `V3-24` Personal memory — Second-brain searchable life-log

*As a user, I want a searchable timeline of everything I've captured.*

**Acceptance criteria**
- Chronological ambient memory
- deep recall (what did X say about Y last week)
- privacy-scoped.

**Persona:** User  ·  **Target:** All  ·  **Component:** AI-LLM, Backend  ·  **Priority:** P1  ·  **Effort:** XL  ·  **Depends on:** V1-05, V3-17

##### `V3-25` Personal memory — Proactive ambient insights

*As the system, I want to surface commitments and highlights from the ambient stream.*

**Acceptance criteria**
- Daily highlights
- surfaces promises/commitments you made
- gentle, non-spammy nudges.

**Persona:** System  ·  **Target:** All  ·  **Component:** AI-LLM  ·  **Priority:** P2  ·  **Effort:** M  ·  **Depends on:** V3-24, V2-01

---

## 10. Key product flows

**A. Capture → useful output (the core loop)**

1. User starts capture on mobile, taps the Chrome extension, or uploads a file.
2. Audio is chunked and streamed to Bangla STT (`INIT-11`), handling code-switch (`INIT-13`); a live transcript renders (`INIT-14`).
3. On completion the system produces a summary, action items, and a title/tags (`MVP-01/04/07`).
4. The session lands in memory and the library, reachable from the portal (`MVP-29/30`).

**B. Recall**

1. User searches keywords (`MVP-08`) or asks a question of a session (`MVP-10`) — later, across all sessions (`V1-05`).
2. Answers are grounded with timestamps; in V3 the user can ask out loud in Bangla and hear the answer (`V3-07/08`).

**C. Act (V3 agentic)**

1. From a session's decisions, Doppio drafts follow-ups, proposes calendar events, and creates reminders (`V3-10/11/12`).
2. The user reviews and approves; actions are logged (`V3-16`).

**D. Ambient (V3)**

1. With consent, Doppio captures passively all day (`V3-17`), auto-segments into sessions (`V3-18`), and applies the right context lens (`V3-21`) — e.g. healthcare (`V3-22`).
2. Everything feeds the searchable life-log (`V3-24`) under strict privacy controls (`V3-19`).

## 11. Non-functional requirements

- **Bangla quality (gating).** STT WER and summary/comprehension quality must meet the `INIT-21` thresholds on a curated Bangla + code-switch set before launch, and the AI layer must pass `MVP-27`. Quality is tracked every build.
- **Latency.** Live transcript < 1.5s; Ask answers and live interpretation targets < 2s.
- **Offline & low bandwidth.** Data-light mode (`MVP-25`) and offline transcription (`MVP-26`) for 2G/3G and patchy networks.
- **Battery.** Background and ambient capture must hit the 12h+ target within a defined per-hour drain budget (`INIT-08`, `V3-17`).
- **Privacy & security.** Encryption at rest on-device (`INIT-15`); on-device/no-retention private mode (`INIT-18`); ambient consent, mute-zones, and retention controls (`V3-19`, P0).
- **Scalability.** STT and LLM inference services scale horizontally; metering (`MVP-15`) protects unit economics.
- **Localization & accessibility.** Full Bangla UI (`INIT-03/04`); readable on low-end devices; intelligible Bangla TTS on low-end speakers (`V3-08`).

## 12. Monetization & pricing

- **Free tier** with limited transcription hours (`MVP-15`) to drive trial and word-of-mouth.
- **Pro** at **Tk 200–300/month** (`MVP-16`) — affordable unlimited core usage; the central pricing wedge.
- **Payments via bKash / Nagad / Rocket** (`MVP-17/18`) — the make-or-break for conversion in a no-card market — plus in-app/web management (`MVP-19`, `MVP-32`).
- **Team / SME plans** with central billing and seats (`V1-15`); **student discount** tier (`V1-16`).
- **Future exploration (not yet in scope):** micro-payments (pay-per-summary via bKash), ad-supported free tier, and telco data-bundle partnerships — promising for Bangladesh but deliberately parked until the subscription model is proven.
- **Quota policy (open decision):** whether an uploaded audio minute (`MVP-35`) counts the same as a live minute against the free/Pro cap.

## 13. Privacy, security & compliance

Trust is load-bearing for Doppio, and the bar rises sharply with always-on capture and clinical use.

- **Local-first & encryption** (`INIT-15`) and a **no-audio-retention private mode** (`INIT-18`) from Phase 0.
- **Ambient guardrails** (`V3-19`, **P0**): explicit consent, pause/mute zones, on-device-only option, and auto-purge rules — these ship *with* ambient, never after.
- **Healthcare** (`V3-22`): on-device privacy for consultations; clinical export must respect patient confidentiality and map cleanly to EMR/Niramoy formats.
- **Enterprise** (V2): SSO + RBAC (`V2-10`), configurable retention/deletion (`V2-12`), and **in-country data residency** (`V2-11`) for compliance-sensitive customers.

## 14. Success metrics (KPIs)

**North-star:** share of a user's relevant conversations that get captured into Doppio (capture rate), and weekly active recall (search/Ask usage).

- **Activation:** % of new users who capture/upload and view a summary within day 1.
- **Retention:** W1/W4 retention; DAU/WAU ratio.
- **Engagement depth:** sessions per active user/week; search + Ask actions per user.
- **Monetization:** free→Pro conversion; MFS payment success rate; MRR; churn.
- **Quality (gating):** Bangla WER and summary-quality scores vs `INIT-21` targets; user-reported correction rate.
- **Trust (ambient/clinical):** opt-in rate for ambient; privacy-control usage; zero tolerance on consent defects.
- **Satisfaction:** NPS; qualitative "could you go back to paper/nothing?" signal.

## 15. Dependencies & critical path

- **The Bangla STT spine** — `INIT-10 → INIT-11 → INIT-13 → INIT-21` — is the backbone; summaries, search, Ask, offline, dialects, and ambient all sit downstream. De-risk first; `INIT-10` is an XL spike (build-vs-API).
- **Payments on the MVP critical path** — no revenue without `MVP-17` (bKash); an L-effort integration to schedule early.
- **Three client surfaces in MVP** — web portal (`MVP-28`), Android, and iOS (`MVP-21`) all land together; the likeliest resourcing crunch (see §17).
- **Ambient builds on the foundation** — `V3-17` depends on background recording (`INIT-08`) and private mode (`INIT-18`).
- **Healthcare lens is late by design** — `V3-22` needs the V2 clinical export (`V2-06`) and medical lexicon (`V2-07`).
- **XL items to split at sprint planning:** `INIT-10/11`, `MVP-21`, `MVP-26`, `V1-09`, `V3-01/04/14/17/22/24`.

## 16. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Bangla STT quality below the trust bar | Product fails its core promise | `INIT-21` gate; build-vs-API spike; curated test sets; ship only when measured-good |
| Ambient capture trust/privacy failure | Reputational, possibly legal | `V3-19` (P0) consent/mute/retention; on-device options; ship guardrails with the feature |
| STT/LLM inference cost at scale | Margin erosion vs Tk 200–300 price | Metering (`MVP-15`); offline/on-device models; right-sized models; cost tracked per build |
| Three-surface MVP resourcing | Slips launch | Sequence (e.g. web + Android at launch, iOS fast-follow) |
| Payment integration friction | Blocks revenue | Prioritise bKash early; phased Nagad/Rocket; robust webhook/failure handling |
| Name/trademark | Rebrand cost | Trademark + domain check on "Doppio" (espresso-term overlap) before public spend |

## 17. Open decisions

1. **MVP surface sequencing** — ship all three surfaces at launch, or web + Android first with iOS as a fast-follow?
2. **Upload quota policy** — does an uploaded minute count the same as a live minute against free/Pro limits?
3. **Launch wedge** — keep dialects (`V3-01`) and live interpretation (`V3-04`) in V3, or pull one forward as the headline differentiator at launch?
4. **STT build-vs-API** (`INIT-10`) — own model vs vendor; drives cost, quality ceiling, and offline feasibility.
5. **Monetization experiments** — when (if) to test micro-payments / ad-supported / telco bundles.
6. **Positioning** — "BD-first that can go global" vs "global launching in BD" (affects brand/marketing, not the matrix).

## 18. Glossary

| Term | Meaning |
|---|---|
| **STT** | Speech-to-text (transcription). |
| **WER** | Word error rate — the standard transcription-accuracy metric (lower is better). |
| **Code-switch** | Mixing two languages (here Bangla and English) within speech, often mid-sentence. |
| **Diarization** | Determining who spoke when (speaker separation). |
| **RAG** | Retrieval-augmented generation — grounding AI answers in the user's own content. |
| **Ambient capture** | Always-on passive recording of one's day, auto-segmented into sessions. |
| **Context lens / super-mode** | Applying a domain template (e.g. healthcare, education) to a captured session. |
| **SOAP** | Subjective/Objective/Assessment/Plan — a standard clinical note structure. |
| **EMR** | Electronic medical record. |
| **MFS** | Mobile financial services — bKash, Nagad, Rocket. |
| **TTS** | Text-to-speech. |
| **Persona** | The actor in a requirement: User, System, or Admin. |

## 19. Appendix — requirement traceability index

All 118 requirements, in build order. IDs match `Doppio_Feature_Matrix.xlsx`.

| ID | Phase | Feature — Task | Persona | Priority | Effort | Depends on |
|---|---|---|---|---|---|---|
| `INIT-01` | Initial | Phone / Email OTP sign-up — Phone + OTP auth flow | User | P0 | M | — |
| `INIT-02` | Initial | Phone / Email OTP sign-up — Email sign-up fallback | User | P1 | S | INIT-01 |
| `INIT-03` | Initial | Bangla / English UI toggle — i18n localization framework | User | P0 | M | — |
| `INIT-04` | Initial | Bangla / English UI toggle — Bangla translation pass | User | P0 | S | INIT-03 |
| `INIT-05` | Initial | Guided first-run walkthrough — Onboarding + permission primers | User | P1 | S | INIT-03 |
| `INIT-06` | Initial | In-person mobile recording — Mic capture + recording controls | User | P0 | M | — |
| `INIT-07` | Initial | In-person mobile recording — Audio chunking pipeline | System | P0 | M | INIT-06 |
| `INIT-08` | Initial | Background + low-battery recording — Background recording service | System | P0 | L | INIT-06 |
| `INIT-09` | Initial | Pause / resume recording — Pause/resume control + state | User | P1 | S | INIT-06 |
| `INIT-10` | Initial | Bangla speech-to-text engine — STT approach eval (build vs API) | System | P0 | XL | — |
| `INIT-11` | Initial | Bangla speech-to-text engine — Bangla STT inference service | System | P0 | XL | INIT-10 |
| `INIT-12` | Initial | Bangla speech-to-text engine — Dialect, punctuation & numerals | System | P1 | L | INIT-11 |
| `INIT-13` | Initial | Bangla–English code-switch — Code-switch language model | System | P0 | L | INIT-11 |
| `INIT-21` | Initial | Bangla quality gate — Bangla quality benchmark & release gate | System | P0 | M | INIT-11, INIT-13 |
| `INIT-14` | Initial | Live transcript view — Real-time transcript UI | User | P1 | M | INIT-11 |
| `INIT-15` | Initial | Local-first storage — On-device encrypted store | System | P0 | M | — |
| `INIT-16` | Initial | Recording / session list — Session list + detail screen | User | P0 | M | INIT-15 |
| `INIT-17` | Initial | Recording / session list — Delete / rename session | User | P1 | S | INIT-16 |
| `INIT-18` | Initial | On-device transcription (no audio retention) — Private mode | System | P0 | M | INIT-11, INIT-15 |
| `INIT-19` | Initial | Core backend — Auth / identity + API gateway | System | P0 | L | — |
| `INIT-20` | Initial | Core infra — CI/CD, environments, monitoring | System | P0 | L | — |
| `MVP-01` | MVP | Auto session summary — Summarization pipeline | System | P0 | L | INIT-11 |
| `MVP-02` | MVP | Auto session summary — Prompt + output templates | System | P0 | M | MVP-01 |
| `MVP-03` | MVP | Auto session summary — Summary view + regenerate | User | P1 | S | MVP-01 |
| `MVP-04` | MVP | Action item extraction — To-do extraction | System | P0 | M | MVP-01 |
| `MVP-05` | MVP | Action item extraction — To-do management UI | User | P1 | M | MVP-04 |
| `MVP-06` | MVP | Editable notes — Inline note editor | User | P1 | M | INIT-14 |
| `MVP-07` | MVP | Auto title & tagging — Auto-title + topic tags | System | P1 | S | MVP-01 |
| `MVP-08` | MVP | Keyword search — Full-text search index | User | P0 | M | INIT-16 |
| `MVP-09` | MVP | Keyword search — Search UI + filters | User | P1 | S | MVP-08 |
| `MVP-10` | MVP | Ask Doppio — RAG over single session | User | P0 | L | MVP-01 |
| `MVP-11` | MVP | Ask Doppio — Chat UI | User | P1 | M | MVP-10 |
| `MVP-12` | MVP | Chrome extension — Extension scaffold + tab audio capture | User | P0 | L | INIT-07 |
| `MVP-13` | MVP | Chrome extension — Extension transcript/summary panel | User | P0 | M | MVP-12, MVP-01 |
| `MVP-14` | MVP | Quick voice note — One-tap voice memo | User | P1 | S | INIT-06 |
| `MVP-15` | MVP | Free tier — Usage metering + caps | System | P0 | M | INIT-19 |
| `MVP-16` | MVP | Pro subscription — Plans + entitlements | System | P0 | M | MVP-15 |
| `MVP-17` | MVP | bKash / Nagad / Rocket — bKash integration | User | P0 | L | MVP-16 |
| `MVP-18` | MVP | bKash / Nagad / Rocket — Nagad + Rocket integration | User | P1 | M | MVP-17 |
| `MVP-19` | MVP | In-app subscription mgmt — Manage / cancel / upgrade | User | P1 | M | MVP-16 |
| `MVP-20` | MVP | Cross-surface sync (web · mobile · Chrome) — Cloud sync service | System | P0 | L | INIT-15, INIT-19 |
| `MVP-21` | MVP | iOS app — iOS parity build | User | P0 | XL | INIT-06, INIT-11, MVP-01 |
| `MVP-22` | MVP | Encrypted cloud backup — Optional encrypted backup | User | P1 | M | MVP-20 |
| `MVP-23` | MVP | Share summary — Share to WhatsApp / link | User | P0 | S | MVP-01 |
| `MVP-24` | MVP | Export PDF / Word — Export transcript + summary | User | P1 | M | MVP-01 |
| `MVP-25` | MVP | Data-light mode — Bandwidth optimization | System | P1 | M | MVP-20 |
| `MVP-26` | MVP | Offline transcription — On-device offline STT model | System | P2 | XL | INIT-11 |
| `MVP-27` | MVP | Bangla AI-quality validation — Validate summaries / action items / Q&A on Bangla | System | P0 | M | MVP-01, MVP-04, MVP-10 |
| `MVP-28` | MVP | Web app shell & auth — Responsive web portal + sign-in | User | P0 | L | INIT-19 |
| `MVP-29` | MVP | Session library — Web library & dashboard | User | P0 | M | MVP-28, INIT-16 |
| `MVP-30` | MVP | Session workspace — Web transcript / summary / notes view | User | P0 | L | MVP-28, MVP-01, MVP-06 |
| `MVP-31` | MVP | Search & Ask on web — Web search + Ask Doppio | User | P1 | M | MVP-08, MVP-10, MVP-28 |
| `MVP-32` | MVP | Account & billing — Web subscription & billing centre | User | P0 | M | MVP-16, MVP-28 |
| `MVP-33` | MVP | Settings & privacy — Web settings & privacy controls | User | P1 | M | MVP-28 |
| `MVP-34` | MVP | Export & share — Web export & share | User | P1 | S | MVP-23, MVP-24, MVP-28 |
| `MVP-35` | MVP | File upload — Audio/video upload → transcribe & summarize | User | P1 | M | INIT-11, MVP-01, MVP-15 |
| `MVP-36` | MVP | Share-to-Doppio — WhatsApp / share-sheet voice-note import | User | P1 | S | MVP-35 |
| `MVP-37` | MVP | Text import — Transcript / text-note import | User | P2 | S | INIT-16 |
| `V1-01` | V1 | Generate docs — Content-generation engine | User | P1 | M | MVP-01 |
| `V1-02` | V1 | Generate docs — Study guide / email / MoM formats | User | P1 | M | V1-01 |
| `V1-03` | V1 | Domain templates — SOAP / minutes / interview templates | User | P1 | M | V1-01 |
| `V1-04` | V1 | Auto-translate — Bangla ↔ English translation | System | P1 | M | MVP-01 |
| `V1-05` | V1 | Deep search across meetings — Cross-session RAG | User | P1 | L | MVP-10 |
| `V1-06` | V1 | Deep search across meetings — Bangla vector index | System | P1 | L | V1-05 |
| `V1-07` | V1 | Proactive suggestions — Live suggestion engine | System | P2 | L | MVP-10 |
| `V1-08` | V1 | Google Calendar sync — Calendar OAuth + event import | System | P1 | M | INIT-19 |
| `V1-09` | V1 | Meeting bot — Zoom/Meet/Teams join-bot | User | P1 | XL | MVP-01 |
| `V1-10` | V1 | Gmail follow-up — Gmail send integration | User | P2 | M | V1-01 |
| `V1-11` | V1 | Shared workspaces — Teams / workspaces + roles | User | P1 | L | MVP-20 |
| `V1-12` | V1 | Shared workspaces — Workspace UI | User | P1 | M | V1-11 |
| `V1-13` | V1 | Comments & highlights — Transcript annotation | User | P2 | M | V1-11 |
| `V1-14` | V1 | Speaker identification — Diarization pipeline | System | P1 | L | INIT-11 |
| `V1-15` | V1 | Team / SME plans — Team billing + seats | Admin | P1 | M | MVP-16, V1-11 |
| `V1-16` | V1 | Student discount — Student verification tier | User | P2 | S | MVP-16 |
| `V1-17` | V1 | Workspace admin — Web workspace & member management | Admin | P1 | M | V1-11 |
| `V1-18` | V1 | Integrations hub — Web integrations management | User | P2 | S | V1-08, V1-09, V1-10 |
| `V1-19` | V1 | Document to memory — Document upload (PDF/DOCX/image OCR) | User | P1 | L | V1-05, V1-06 |
| `V1-20` | V1 | Bulk import — Bulk / folder import & migration | User | P2 | M | MVP-35 |
| `V1-21` | V1 | Link ingestion — Link / article ingestion | User | P2 | M | V1-06 |
| `V2-01` | V2 | Daily / weekly digest — Digest generation + delivery | System | P2 | M | V1-05 |
| `V2-02` | V2 | Cross-meeting insights — Theme / connection detection | System | P2 | L | V1-05 |
| `V2-03` | V2 | Multi-LLM choice — Model selector + routing | User | P2 | M | MVP-02 |
| `V2-04` | V2 | Custom AI assistants — Assistant / persona builder | User | P2 | L | V2-03 |
| `V2-05` | V2 | Live translated captions — Real-time translation overlay | System | P2 | XL | V1-04 |
| `V2-06` | V2 | EMR-ready clinical note export — Structured clinical export | User | P2 | L | V1-03 |
| `V2-07` | V2 | Medical dictionary — Bangla/English medical lexicon | System | P2 | M | INIT-13 |
| `V2-08` | V2 | Lecture → quiz / flashcards — Quiz / flashcard generator | User | P2 | M | V1-01 |
| `V2-09` | V2 | Admin dashboard — Usage analytics dashboard | Admin | P2 | L | V1-15 |
| `V2-10` | V2 | SSO & RBAC — SSO + role-based access | Admin | P2 | L | V1-11 |
| `V2-11` | V2 | Data residency — In-country hosting option | Admin | P2 | L | INIT-20 |
| `V2-12` | V2 | Retention policy — Configurable retention controls | Admin | P2 | M | INIT-15 |
| `V2-13` | V2 | Public API / webhooks — Developer API + webhooks | Admin | P2 | L | INIT-19 |
| `V2-14` | V2 | Referral program — Referral / affiliate system | User | P2 | M | MVP-16 |
| `V3-01` | V3 | Regional dialect STT — Dialect-adaptive Bangla models | System | P1 | XL | INIT-11, INIT-13 |
| `V3-02` | V3 | Regional dialect STT — Dialect auto-detection | System | P2 | L | V3-01 |
| `V3-03` | V3 | Vernacular normalization — Colloquial / numeral / date normalization | System | P2 | M | INIT-12 |
| `V3-04` | V3 | Live Bangla-English interpretation — Real-time two-way interpretation | System | P1 | XL | V1-04, V2-05 |
| `V3-05` | V3 | Live Bangla-English interpretation — Per-speaker translated captions | System | P2 | L | V3-04, V1-14 |
| `V3-06` | V3 | Live Bangla-English interpretation — Bilingual aligned transcript export | User | P2 | M | V3-04 |
| `V3-07` | V3 | Bangla voice agent — Voice query — ask out loud in Bangla | User | P1 | L | V1-05 |
| `V3-08` | V3 | Bangla voice agent — Natural Bangla text-to-speech | System | P2 | L | V3-07 |
| `V3-09` | V3 | Bangla voice agent — Hands-free conversational mode | User | P2 | M | V3-07 |
| `V3-10` | V3 | Auto follow-up — Auto-draft & send follow-ups | User | P1 | L | V1-01, V1-10 |
| `V3-11` | V3 | Auto follow-up — Auto-schedule from decisions | System | P1 | M | V1-08 |
| `V3-12` | V3 | Task automation — Action-item to reminder/task automation | System | P1 | M | MVP-04, MVP-05 |
| `V3-13` | V3 | Document automation — Form & document auto-fill | User | P2 | L | V1-03 |
| `V3-14` | V3 | Agentic workflows — Custom trigger-to-action recipes | User | P2 | XL | V3-10, V3-12 |
| `V3-15` | V3 | Proactive prep — Pre-meeting briefing agent | System | P2 | M | V1-05, V1-08 |
| `V3-16` | V3 | Action approval — Multi-step execution with approval & audit | User | P2 | L | V3-10, V3-11 |
| `V3-17` | V3 | Always-on ambient capture — Continuous low-power ambient recording | System | P1 | XL | INIT-08, INIT-18 |
| `V3-18` | V3 | Always-on ambient capture — Auto conversation segmentation | System | P1 | L | V3-17 |
| `V3-19` | V3 | Ambient privacy — Consent, mute-zones & retention controls | System | P0 | M | V3-17, V2-12 |
| `V3-20` | V3 | Wearable support — BT mic / wearable integration | User | P2 | L | V3-17 |
| `V3-21` | V3 | Context-aware modes — Auto context detection & lens switching | System | P1 | L | MVP-07, V1-03 |
| `V3-22` | V3 | Healthcare ambient mode — Consultation lens to structured note + Rx (Niramoy) | User | P1 | XL | V2-06, V2-07, V3-21 |
| `V3-23` | V3 | Education ambient mode — Lecture lens to notes + study pack | User | P2 | L | V2-08, V3-21 |
| `V3-24` | V3 | Personal memory — Second-brain searchable life-log | User | P1 | XL | V1-05, V3-17 |
| `V3-25` | V3 | Personal memory — Proactive ambient insights | System | P2 | M | V3-24, V2-01 |

---

*End of document. Generated from the locked Doppio feature matrix (v1.0, 118 requirements). Update the matrix and regenerate to keep this PRD in sync.*