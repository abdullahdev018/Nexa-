# Nexa AI

**Your AI Marketing Team.** Give Nexa your product; Nexa builds your marketing campaign.

A multi-tenant SaaS for solo marketers, small businesses, shops, creators and
small agencies: Brand Kit, a campaign generator, Content Studio, AI video
plans, Ad Studio, a marketing calendar, analytics with Nexa Insights, and an AI
assistant that knows the brand — on monthly credits, per workspace. Built with
Next.js, TypeScript, Tailwind, Prisma and PostgreSQL.

The AI provider key never reaches the browser — every model request goes
through a server route.

**Nothing is faked.** Nexa is not connected to any social, ad, video or payment
provider, and every screen says so instead of pretending. Each of those lines
lives in one place: `lib/video/render.ts`, `lib/ads/launch.ts`,
`lib/billing/payments.ts`, and `CALENDAR_NOTICE` in `lib/calendar/plan.ts`.

---

## Running it

You need Node 20+ and a PostgreSQL database — Docker or a local install.

```bash
# .env.local already exists here; only needed on a fresh clone:
# cp .env.example .env.local
npm install                # runs prisma generate
npm run db:up              # starts Postgres in Docker
npm run db:deploy          # creates the tables
npm run db:seed            # optional demo account
npm run verify:key         # confirms the provider accepts your key
npm run dev                # http://localhost:3000
```

To test the paid plans' features locally, start with
`NEXA_DEV_PLAN_SWITCH=1 npm run dev`: `/billing` then offers a development-only
plan switch. It never runs in production and is recorded in the credit
history as not a purchase.

Your key goes on **line 20 of `.env.local`**, the line marked with a 👇 arrow.
[`docs/ADD-API-KEY.md`](docs/ADD-API-KEY.md) walks through it step by step.

The seed creates `demo@nexa.local` / `demopass123` with two conversations.

**Without Docker**, point `DATABASE_URL` at any PostgreSQL instance and skip
`npm run db:up`.

**Without an API key**, everything works except generating: the AI routes
answer `503` with an explanation, and the UI shows it rather than pretending.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Generates the Prisma client, then a production build |
| `npm start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`node --test`) |
| `npm run db:migrate` | Create and apply a migration from schema changes |
| `npm run db:deploy` | Apply existing migrations (use this in CI/production) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Demo account and conversations |
| `npm run verify:key` | Checks the AI provider accepts the configured key |

---

## How it is put together

```
app/
  page.tsx  pricing/       landing and pricing (plans read from lib/billing/plans.ts)
  login/  signup/  onboarding/  privacy/  terms/
  (app)/                   everything behind a session — requireWorkspace() in layout.tsx
    dashboard/  brand/  campaigns/  content/  video/  ads/
    calendar/  analytics/  billing/  chat/  settings/  account/
  api/                     one folder per resource; AI routes rate-limited and credit-checked
components/                one folder per section, plus ui/ and app/ (shell, PlanLock…)
lib/
  auth/workspace.ts        the tenancy root: every query scopes on the workspace from here
  billing/                 plans, credits ledger, payThenSave, payments seam, usage
  brand/  campaigns/  studio/  video/  ads/  calendar/  analytics/
                           each: plan.ts (pure — schemas, prompts, parsing, with tests)
                           and generate.ts or service.ts (server-only)
  ai/                      provider abstraction (types, registry, adapters, generateText)
  content/                 site copy and the app navigation
prisma/schema.prisma       Workspace is the tenant; User owns and joins workspaces
proxy.ts                   signed-out redirects, and the cross-origin check on /api
```

### Tenancy and credits

A **workspace** is the tenant, not a user: plans, credits and every piece of
work belong to it, so an agency can one day own client workspaces. Every
route resolves the workspace from the session and scopes each query on it;
an id from a URL or body is only used after it is checked against it.

Credits are per workspace, in an append-only ledger (`CreditTransaction`,
each row with the balance after it). **A generation is charged only if it
succeeded** — and it is charged *before* its result is saved, by
`payThenSave` in `lib/billing/settle.ts`. The order matters: charging after
saving would let simultaneous requests all pass the balance check and keep
their results for the price of one. Chat, which streams, reserves its credit
up front and refunds it if no reply arrives. Every model call — failures too —
is logged in `AIUsage`.

Plans live in `lib/billing/plans.ts`, never in the database, so prices and
allowances change without a migration. Capabilities in `UNBUILT` are shown as
"Soon" on every pricing surface, and tests keep it that way.

### Authentication

Email and password, with server-side sessions — no third-party auth service.

- Passwords are hashed with **bcrypt** (cost 12). A login attempt for an
  unknown address still spends the same time hashing, so response timing does
  not reveal which addresses are registered.
- The session cookie holds a 256-bit random token; the database stores only its
  **SHA-256**. A database leak therefore does not hand over live sessions.
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production. Sessions
  last 30 days and slide forward when used.
- Changing a password invalidates every other session.

**Adding Google OAuth later** does not require a migration. Credentials already
live on a separate `Account` row keyed by `(provider, providerAccountId)`, so a
Google login is another `Account` pointing at the same `User`.

### The AI layer

`lib/ai/` is the only part of the codebase that knows which model provider is
in use. Everything above it — routes, components, the database — speaks in the
types from `lib/ai/types.ts`.

To swap provider: implement `AIProvider` (one `stream()` method returning an
async iterable of typed events), add it to the map in `lib/ai/index.ts`, and
set `AI_PROVIDER`. No other file changes.

The three product tiers in `lib/ai/models.ts` (`nexa-swift`, `nexa-balanced`,
`nexa-deep`) are stable ids stored on conversations and preferences; the
adapter maps them onto real models, so the mapping can change without touching
stored data.

### Chat streaming

`POST /api/chat` returns Server-Sent Events: `start` (thread id and title),
`delta` (text), `error`, `done`. The client renders each chunk as it arrives.
Pressing **Stop** aborts the request, which aborts the upstream call, so tokens
nobody will read are not paid for. Partial replies — and failures — are
persisted, so a reloaded thread reads the same as it did live.

### Files

Text files (code, CSV, JSON, markdown) are inlined into the message; images
become vision blocks. **The bytes are never stored** — they go to the provider
once and are dropped. Only the name, type and size are kept, which is enough to
redraw the attachment chips in a reopened conversation.

Limits: 5 files per message, 5 MB each.

### Markdown and highlighting

`lib/utils/markdown.ts` parses replies into a typed tree and
`components/chat/Markdown.tsx` turns that into React elements. No HTML is ever
produced from model output, so there is nothing to sanitise — markup in a reply
is text. `lib/utils/highlight.ts` is a compact tokeniser covering the common
languages, which avoids shipping a full highlighting library.

Both have unit tests: `npm test`.

### Rate limiting

In-memory fixed-window limits on sign-up (5/hour per IP), login (10 per 15
minutes, per IP *and* per normalised address), password changes and account
deletion (5 per 15 minutes per user), chat (30/minute) and every generation
route. The client address comes from headers the host sets (Vercel's), not
from a client-supplied `X-Forwarded-For`. This is sized for a single instance;
behind several, move the store in `lib/utils/rate-limit.ts` to Redis.

### Hardening

- **CSRF:** the session cookie is `SameSite=Lax`, and `proxy.ts` also refuses
  any state-changing `/api` request whose `Sec-Fetch-Site`/`Origin` is not this
  origin — which covers sibling subdomains that Lax trusts.
- **Headers** (`next.config.ts`): no framing (`frame-ancestors 'none'`,
  `X-Frame-Options`), `nosniff`, a referrer policy, a permissions policy, and
  HSTS in production. The CSP does not yet restrict scripts; that needs a
  per-request nonce.
- **Destructive actions:** deleting the account takes the password, and says
  exactly what goes with it — every workspace the user owns.
- **Errors:** `app/(app)/error.tsx` and `app/global-error.tsx` show a
  reference, never the error text; provider errors reach users as fixed
  messages only.

---

## Deploying to Vercel

1. Push the repository and import it in Vercel.
2. Add a PostgreSQL database (Vercel Postgres, Neon or Supabase) and set
   `DATABASE_URL` to its **pooled** connection string.
3. Set the environment variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Pooled Postgres connection string |
   | `AI_PROVIDER` | `openrouter` (default) or `anthropic` |
   | `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` | The key for that provider |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |

   Never set `NEXA_DEV_PLAN_SWITCH` in production (it is ignored there anyway).

4. Run the migrations against that database once:
   `DATABASE_URL="…" npx prisma migrate deploy`

`npm run build` runs `prisma generate` first, so the client is always built
against the current schema. The generation routes declare `maxDuration`
(up to 300 seconds for a whole campaign), because a long generation can
outlast the default function timeout.

---

## What is deliberately not here

Stated plainly so nothing on the site over-promises:

- **No payment processing.** Plans are priced but cannot be bought; every
  account starts on Free, and the site and `/billing` say so.
- **No publishing, ad launching or video rendering.** Nexa writes; the user
  posts, launches and films. Each is one seam away (see the top of this file).
- **No live analytics connections.** Results are imported as CSV; sample data
  lives in a separate, labelled demo view and is never mixed with real numbers.
- **Not built, and marked "Soon" on pricing:** competitor research, team
  invites, client workspaces, bulk generation, white-label reports.
- **No Google OAuth yet**, though the schema is ready for it.
- **No email sending**, so there is no password-reset flow.
- **No admin surface.** Outside development, plan changes are database updates.
