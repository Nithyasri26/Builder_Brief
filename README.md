# NammaSahaay AI

**One conversation. Every public service.**

> Don't make citizens learn government systems. Let them simply explain what they need.

NammaSahaay AI is a conversational citizen-service prototype. A citizen says what they
need in ordinary language — *"my husband passed away, I have one daughter and no job, is
there any government support?"* — and the product works out which service applies, what it
requires, which documents the citizen already has, what still needs answering, and then
keeps the whole thing tracked in one place.

**This is an independent prototype. Every government integration in it is simulated.** No
real government account, Aadhaar, PAN, UAN, payment or OTP is used, and nothing is
submitted to any government system.

---

## Table of contents

1. [Problem statement](#1-problem-statement)
2. [Target users](#2-target-users)
3. [Solution](#3-solution)
4. [Why existing digital infrastructure is still hard at the interaction level](#4-why-existing-digital-infrastructure-is-still-hard-at-the-interaction-level)
5. [Product architecture](#5-product-architecture)
6. [AI architecture](#6-ai-architecture)
7. [Government adapter architecture](#7-government-adapter-architecture)
8. [Cost optimisation](#8-cost-optimisation)
9. [Security](#9-security)
10. [Privacy](#10-privacy)
11. [Demo data](#11-demo-data)
12. [Mock integrations](#12-mock-integrations)
13. [Real integration roadmap](#13-real-integration-roadmap)
14. [Installation](#14-installation)
15. [Environment variables](#15-environment-variables)
16. [Local development](#16-local-development)
17. [Deployment (Vercel)](#17-deployment-vercel)
18. [Demo journey](#18-demo-journey)
19. [Limitations](#19-limitations)
20. [Future roadmap](#20-future-roadmap)
21. [Project structure](#21-project-structure)

---

## 1. Problem statement

Citizens think in **outcomes**: *I need money for my daughter's school fees. I need my PF
money. I need a passport. My pension has not arrived.*

Public service delivery is organised around **services and departments**: EPFO, DigiLocker,
Passport Seva, the state welfare department, the grievance portal, the railways.

Bridging the two is work the citizen has to do today:

```
Citizen → search → find the right portal → work out the department →
log in → find the service → decode the terminology → fill the form →
upload documents → submit → remember the application number →
come back to a different site later → check status
```

Every one of those steps is a place where somebody with limited digital literacy stops.

## 2. Target users

- Citizens with limited digital literacy or limited formal education
- Older citizens, and citizens who mainly use a phone on a slow connection
- Anyone who does not know which department owns the service they need
- Anyone who has been asked for the same document by three different services

The demo profile — a widowed 34-year-old in Bengaluru with one dependent child, currently
unemployed, educated to 8th standard — is chosen because she is exactly the person the
current interaction model serves worst.

## 3. Solution

A conversational orchestration layer **above** existing public services:

```
Citizen → "I need X" → intent understood → what is already known is checked →
service identified → requirements explained in simple words →
existing documents reused → only missing information asked →
workflow prepared → citizen confirms → submission → unified tracking →
notifications → documents and history stay available
```

The product does six things well:

| | |
|---|---|
| **Understand** | Plain language in, structured intent out |
| **Discover** | Which service or programme actually applies |
| **Check** | Deterministic eligibility, always framed as *potential* |
| **Collect** | Reuse documents the citizen already holds |
| **Apply** | Prepare, review, and let the citizen confirm |
| **Track** | One list for every service, with status and next action |

## 4. Why existing digital infrastructure is still hard at the interaction level

India has created extensive digital public infrastructure, and many public services are
already available digitally. That infrastructure is not the problem, and this project does
not try to replace it.

The remaining difficulty is at the **interaction layer**. Each service has its own
vocabulary, its own document list, its own form, its own status page. A citizen who does not
already know the system has to learn the system before they can use it. NammaSahaay's
contribution is to remove that learning requirement: the citizen describes an outcome, and
the product handles the mapping to services, terminology and workflows — always pointing at
the official service as the authority.

## 5. Product architecture

```
                        ┌──────────────────────────────┐
   Citizen  ──────────► │  Conversation (Next.js UI)   │
                        └──────────────┬───────────────┘
                                       │  POST /api/chat
                        ┌──────────────▼───────────────┐
                        │      Chat orchestrator       │
                        │  understand → route → run    │
                        └───┬───────────┬───────────┬──┘
                            │           │           │
              ┌─────────────▼──┐  ┌─────▼──────┐  ┌─▼──────────────┐
              │  AI layer      │  │ Workflow   │  │ Eligibility    │
              │ (intent only)  │  │ engine     │  │ rules engine   │
              └────────────────┘  └─────┬──────┘  └────────────────┘
                                        │
                        ┌───────────────▼────────────────┐
                        │   Government adapter layer     │
                        │  EPFO · DigiLocker · Schemes   │
                        │  Passport · Grievance · Rail   │
                        └───────────────┬────────────────┘
                                        │
                        ┌───────────────▼────────────────┐
                        │   Database + storage + email   │
                        │   MongoDB (in-memory demo      │
                        │   store when unconfigured)     │
                        └────────────────────────────────┘
```

Key decisions:

- **Business logic never lives in React components.** Components render structured content
  blocks; every decision is made server-side.
- **The workflow engine is generic.** One task model (`CitizenTask`) covers provident fund,
  passport, scheme, complaint and rail. Pause and resume are not special cases — they are
  simply the state a task is already in, which is why *"I'll do it later"* and *"continue my
  PF withdrawal"* work for every service.
- **Applications are a read model over tasks**, so a workflow and its application record can
  never drift apart.

### Database

**MongoDB is the database.** One collection per record type, and each document *is* the
typed record — no ORM, no mapping layer, `_id` is the record's own id. That matters here
because the domain is naturally document-shaped: a chat message carries its rendered content
blocks, and a task carries its step data and timeline. Those live as nested structures
rather than as something to flatten on write and rebuild on read.

| Collection | Holds | Index |
|---|---|---|
| `profiles` | citizen profile, `_id` = user id | — |
| `conversations` | chat threads | `userId + updatedAt desc` |
| `messages` | every turn, with its content blocks | `conversationId + createdAt` |
| `documents` | the document wallet | `userId + addedAt desc`, `userId + purposes` |
| `digilocker_documents` | the simulated wallet, per citizen | `userId` |
| `tasks` | the citizen task engine — every workflow | `userId + updatedAt desc`, `userId + status` |
| `complaints` | grievance drafts and records | `userId + createdAt desc` |
| `notifications` | citizen notifications | `userId + createdAt desc` |
| `downloads` | generated demo files | `userId + createdAt desc` |
| `train_searches` | journey searches | `userId + createdAt desc` |
| `audit_events` | consequential actions | `userId + timestamp desc` |
| `uploads` | uploaded file bytes (4 MB cap, so no GridFS) | — |

Indexes are created on first connection. The `userId + purposes` index on `documents` is the
one that makes document reuse cheap: a workflow asks for a *purpose* ("address proof"), not
a filename.

Applications are **not** a collection — they are derived from `tasks`, so a workflow and its
application record can never disagree.

Two other implementations satisfy the same `Database` interface and are chosen by
environment alone: an **in-memory seeded store** (the zero-setup default, so the demo runs
with no infrastructure at all) and a **Postgres/Supabase adapter** kept as an alternative,
with its DDL in `lib/database/schema.sql`.

## 6. AI architecture

The model is used for **language understanding only**. It never decides eligibility, never
performs an action, and never invents a rule, an amount or a reference number.

```
interface AIProvider {
  understandIntent(input, context): Promise<IntentResult>;
  generateResponse(input, context): Promise<string>;
}

AIProvider
 ├── GeminiProvider          (default, REST — no vendor SDK)
 ├── OpenAIProvider          (hosted OpenAI)
 ├── LocalModelProvider      (Ollama / vLLM / llama.cpp — Qwen, Gemma, Llama …)
 └── NullProvider            (no key configured; the product still works)
```

Nothing outside `lib/ai/` imports a provider. Swapping models is an environment variable.

**Structured output is never trusted.** Every model response is parsed and validated with
Zod (`lib/ai/schemas.ts`); an invalid response degrades to `UNKNOWN`, which produces a
clarifying question rather than a guess.

**The separation that matters:**

```
Citizen language → AI → structured CitizenSituation → Eligibility engine → Scheme data → Potential match
                   ▲                                  ▲
            interpretation only              deterministic TypeScript
```

## 7. Government adapter architecture

Every public service sits behind an interface in `lib/services/`. `lib/services/registry.ts`
is the single place where an adapter is chosen:

```
GovernmentService
 ├── EPFOService        → MockEPFOService
 ├── DigiLockerService  → MockDigiLockerService
 ├── SchemeService      → MockSchemeService
 ├── PassportService    → MockPassportService
 ├── ComplaintService   → MockComplaintService
 ├── RailService        → MockRailService
 └── UMANGService       → MockUMANGService   (service directory)
```

Replacing a mock with an authorised real integration is a change in that folder only. The
conversation, the workflow engine and every citizen-facing screen stay untouched.

Adapters also model failure honestly: `ServiceUnavailableError` produces a retryable
"temporarily unavailable in this prototype" state instead of a crash. Outages are
**deterministic, not random** — set `DEMO_FORCE_OUTAGE=epfo` to demonstrate the path,
because a demo has to be repeatable.

## 8. Cost optimisation

Most citizen requests are short and unambiguous. Sending them to a large model costs money
and adds latency for no benefit, so the product routes work down a ladder:

| Layer | Handles | Model cost |
|---|---|---|
| **1. Rules** (`lib/ai/rule-classifier.ts`) | "show my documents", "I need my PF passbook", "I'll do it later", "withdraw ₹50,000" — including amount, journey, month and life-situation extraction | **zero** |
| **2. Workflow context** | An answer to a question a workflow just asked (*"June"*) is routed back to that workflow | **zero** |
| **3. Model** | Genuinely open-ended language, and life-situation messages that deserve human phrasing | one small call |
| **4. Everything after understanding** | Service calls, eligibility, documents, submissions, wording of results | **zero** |

With no API key configured at all, the entire demo journey still runs — the rule layer
resolves the intents and the deterministic writer produces the wording. That is the strongest
statement of the cost design: **the citizen experience does not change with the model.**

Each assistant message carries a "Why am I seeing this?" line showing which layer answered
and whether it cost a model call.

## 9. Security

- API keys are read server-side only (`lib/config.ts`); nothing but the demo-mode flag is
  exposed to the browser.
- Every route validates its input with Zod before anything reaches a service
  (`lib/validation/schemas.ts`).
- Every route resolves the citizen through one session seam (`lib/security/session.ts`) and
  every document, download, task and complaint is ownership-checked before it is read.
- Rate limiting sits behind a `RateLimiter` interface — an in-process fixed window here, a
  shared store in production. The chat route (the only one that can reach a paid model) has
  its own bucket.
- Uploads are type- and size-restricted (PDF/PNG/JPEG/WebP, 4 MB).
- Errors are caught centrally; internals are never returned to the client.
- Audit events are written for every consequential action (`lib/security/audit.ts`).

## 10. Privacy

- **Data minimisation is enforced in code.** The audit logger drops any metadata key that
  looks like an identifier (Aadhaar, PAN, UAN, account, OTP, email, mobile, address) and
  reduces amounts to coarse bands before writing.
- The assistant never asks for Aadhaar, PAN or bank details — a workflow asks only for what
  it actually uses, and explains why via "Why do you need this?".
- Documents are reused with the citizen's confirmation, never silently attached.
- Row-level security policies are defined in `lib/database/schema.sql` for the Postgres path.

## 11. Demo data

All citizen data is **synthetic**. The demo profile is Lakshmi Devi — 34, Bengaluru,
Karnataka, widowed, one dependent child aged 10, currently unemployed, 8th standard,
household income ₹1,20,000. She does not exist.

Demo identifiers (UAN `100123456789`, PAN `ABCDE1234F`, Aadhaar `XXXX-XXXX-4821`, Voter ID
`DEMO1234567`) are placeholders and are labelled as such wherever they appear.

Scheme data comes in two clearly separated kinds:

| What you see | Meaning |
|---|---|
| A programme with no badge | A sample programme written for this prototype. These exercise the eligibility engine. The About page states plainly that most programmes here are samples. |
| **Government programme** badge | A real, publicly listed programme. Only the name, a neutral description and the official source URL are stored. **No eligibility rules are encoded for these**, because official eligibility is defined by the government — the card links to the official portal instead. |

The wording is deliberately restrained. An earlier version stamped DEMO on every
card, document, status and file name; a usability pass found that the same
disclaimer appeared nine times on one phone screen and buried the actual answer.
The honesty now lives in three places that a citizen actually reads: a line under
the composer, a line in the menu, and the About page — plus a "Sample copy…"
banner inside every generated PDF.

Official sources referenced: [epfindia.gov.in](https://www.epfindia.gov.in),
[digilocker.gov.in](https://www.digilocker.gov.in),
[passportindia.gov.in](https://www.passportindia.gov.in),
[myscheme.gov.in](https://www.myscheme.gov.in), [nsap.nic.in](https://nsap.nic.in),
[sevasindhu.karnataka.gov.in](https://sevasindhu.karnataka.gov.in),
[pgportal.gov.in](https://pgportal.gov.in), [irctc.co.in](https://www.irctc.co.in).

Generated PDFs are real, openable files. Each carries a banner such as
`Sample copy for your reference. Not an official EPFO document.` or
`Sample copy only. This is NOT a ticket and cannot be used to travel.`

## 12. Mock integrations

| Adapter | What it simulates | Never does |
|---|---|---|
| `MockEPFOService` | Passbook, KYC state, withdrawal check and demo submission | Contact EPFO, move money |
| `MockDigiLockerService` | A document wallet with importable issued documents | Touch a real DigiLocker account |
| `MockSchemeService` | Scheme discovery over a demo dataset + official pointers | Decide official eligibility |
| `MockPassportService` | Requirement list, demo submission, appointment centre | File with Passport Seva |
| `MockComplaintService` | Template-composed grievance draft and demo reference | File with any grievance system |
| `MockRailService` | Demo journey options and a demo journey record | Book a ticket, take a payment |

## 13. Real integration roadmap

**Today**

```
Citizen → NammaSahaay → Mock adapter → Synthetic government data
```

**Future**

```
Citizen → NammaSahaay → Government adapter → Official API → Government service
```

| Today | Future |
|---|---|
| `MockEPFOService` | authorised EPFO integration |
| `MockDigiLockerService` | authorised DigiLocker integration |
| `MockSchemeService` | verified government scheme data source |
| `MockComplaintService` | authorised grievance integration |
| `MockRailService` | authorised railway integration |

None of these integrations exist today, and the product says so on every screen that shows
their data.

## 14. Installation

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No API key and no database are needed** — the prototype runs
on the seeded in-memory store and the deterministic AI layer.

## 15. Environment variables

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `gemini` (default), `openai`, `local`, or `none` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini credentials |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI credentials |
| `LOCAL_MODEL_BASE_URL`, `LOCAL_MODEL_NAME` | Any OpenAI-compatible local runtime |
| `MONGODB_URI` | **The database.** Leave blank to use the in-memory demo store |
| `MONGODB_DB` | Database name, default `nammasahaay` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Alternative Postgres adapter, used only when `MONGODB_URI` is empty |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Resend, used only when demo mode is off |
| `NEXT_PUBLIC_DEMO_MODE` | Keep `true`. Demo mode never sends real email |
| `DEMO_FORCE_OUTAGE` | Comma-separated adapter ids to take offline, e.g. `epfo` |

Never commit real keys.

## 16. Local development

```bash
npm run dev         # development server on :3000
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run db:dev          # throwaway local MongoDB on 127.0.0.1:27017
npm run demo:check      # walks the whole demo journey and reports PASS/FAIL per step
npm run passport:check  # the passport journey: parallel documents, end to end
```

`npm run demo:check` (with `npm run dev` running in another terminal) exercises every step
of section 18 against the real API — scheme matching, pause/resume, document reuse,
confirmations, complaint editing, generated PDFs and the reset — and prints a line per
step.

### Running on MongoDB

Start a database — either a throwaway one with no install:

```bash
npm run db:dev
```

or a container:

```bash
docker run -d -p 27017:27017 --name nammasahaay-mongo mongo:7
```

Then in `.env.local`:

```
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=nammasahaay
```

Collections, indexes and the synthetic starting data are created on first request — there is
no migration step. A MongoDB Atlas connection string works the same way.

With `MONGODB_URI` empty the app falls back to the in-memory demo store, so it still starts
with nothing installed. To use the Postgres adapter instead, leave `MONGODB_URI` empty,
apply `lib/database/schema.sql` to a Supabase project and set the three Supabase variables.
`getDatabase()` picks the implementation; no application code changes either way.

## 17. Deployment (Vercel)

1. Push the repository to GitHub.
2. Import it in Vercel — the framework is detected automatically.
3. Add environment variables (all optional; the demo runs without them).
4. Deploy.

Note: with no `MONGODB_URI` the in-memory store is per-instance and resets on cold start.
That is fine for a demo; point `MONGODB_URI` at MongoDB Atlas for a persistent deployment.

## 18. Demo journey

The journey the prototype is built to carry end to end:

1. **"My husband passed away. I have one daughter and I don't have a job. I am not educated.
   Is there any government support?"** — or simply **"i need money"** → empathy, a check of
   what is already known, and the programmes she may be able to get (🟢), with the rest behind
   a "Show 5 more" button.
2. **Check details** on a card → rules, documents, benefit, processing time, source.
3. **Start application** → the four required documents are already in the wallet.
4. **"I'll do it later"** → the task is saved exactly where it is.
5. **Continue** → it resumes at the same step.
6. **Yes, use these papers → Send it** → reference `SCHEME-2026-00401`.
7. **"I also want my PF passbook"** → passbook card, downloadable PDF, demo email.
8. **"I want to take out ₹50,000"** → review screen; nothing moves without confirmation.
9. **"I want to apply for a passport"** → identity, address and date-of-birth documents are
   recognised and reused.
10. **"my pension has not come"** → *"When did you last get the payment?"* → **"June"** → an
    editable draft → send → reference `GRV-2026-00143`.
11. **"I want to go from Bengaluru to Chennai tomorrow"** → demo journey options → review →
    demo record.
12. **My applications / My papers / My files / Updates** → everything is there.
13. **Start again** → back to the beginning, ready for the next person.

## 19. Limitations

- **No real government integration exists.** Every adapter is simulated.
- Single synthetic citizen; there is no authentication yet (`lib/security/session.ts` is the
  seam where it belongs).
- Without `MONGODB_URI` the in-memory store is per-process and resets on restart.
- English only. `lib/language/` holds the interface a translating implementation would use.
- Eligibility is computed only for clearly-labelled demo schemes. The prototype deliberately
  does not evaluate eligibility for official programmes.
- Voice input depends on the browser's own speech recognition; where it is unavailable the
  microphone button is simply not shown.
- The Postgres/Supabase and Resend paths are implemented against their documented APIs but
  are not exercised by the default demo configuration. The MongoDB path is exercised: run
  `npm run demo:check` with `MONGODB_URI` set.

## 20. Future roadmap

- Authentication, then per-citizen data with the RLS policies already written
- Kannada, Hindi, Tamil, Telugu, Malayalam, Bengali, Marathi through `LanguageService`
- A lightweight fine-tuned intent classifier ahead of the model layer
- Queue-based long-running workflows, retries and outbound notifications
- Real integrations, one authorised adapter at a time
- Observability: routing mix, model spend per conversation, drop-off per workflow step

## 21. Project structure

```
app/
  api/            chat, conversations, documents, applications, schemes,
                  epfo, digilocker, passport, complaints, notifications,
                  downloads, profile, services, demo/reset
  (pages)         chat, applications, documents, downloads,
                  notifications, profile, services, about
components/
  chat/           conversation view, composer, voice input, block renderer
  cards/          scheme, document, complaint, task, service and misc cards
  documents/      upload form, DigiLocker panel
  layout/         app shell, sidebar, reset demo
  ui/             buttons, cards, badges, inputs, modal
lib/
  ai/             AIProvider interface, providers, rule classifier, routing
  chat/           orchestrator, intent handlers, action handlers, presenters
  database/       Database interface, MongoDB adapter, in-memory store,
                  Postgres adapter + schema.sql
  documents/      PDF writer, demo document generators, document service
  eligibility/    deterministic rules engine
  email/          EmailProvider interface, demo and Resend providers
  language/       LanguageService interface (English today)
  security/       session seam, ownership checks, rate limiting, audit log
  services/       government adapters + registry
  storage/        StorageProvider interface, memory and Supabase storage
  validation/     Zod schemas for every route
  workflows/      workflow definitions + the citizen task engine
data/demo/        citizen, EPFO, documents, schemes, trains, passport, glossary
types/            ai, user, chat, task, application, document, scheme, complaint
```

---

**NammaSahaay AI is an independent prototype.** It is not affiliated with, endorsed by, or
acting on behalf of any government body. Verify anything that matters on the official
government service.
