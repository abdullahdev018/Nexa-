# Nexa AI

**Think faster. Create more.**

A production-shaped AI assistant: marketing site, email/password accounts,
onboarding, a streaming chat app with saved history, settings and account
management. Built with Next.js, TypeScript, Tailwind, Prisma and PostgreSQL.

The AI provider key never reaches the browser — every model request goes
through a server route.

---

## Running it

You need Node 20+ and either Docker or a local PostgreSQL.

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

Your key goes on **line 20 of `.env.local`**, the line marked with a 👇 arrow.
[`docs/ADD-API-KEY.md`](docs/ADD-API-KEY.md) walks through it step by step.

The seed creates `demo@nexa.local` / `demopass123` with two conversations.

**Without Docker**, point `DATABASE_URL` at any PostgreSQL instance and skip
`npm run db:up`.

**Without an API key**, everything works except generating replies: the chat
route answers `503` with an explanation, and the UI shows it rather than
pretending. Nothing is faked.

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

---

## How it is put together

```
app/
  page.tsx                 landing page
  login/  signup/          auth forms
  onboarding/              three-step setup
  (app)/                   everything behind a session
    layout.tsx             sidebar shell — requireUser() lives here
    chat/                  new chat
    chat/[id]/             one conversation
    settings/  account/
  pricing/ privacy/ terms/
  api/
    auth/                  signup, login, logout
    chat/                  streaming completions (SSE)
    conversations/         list, create, read, rename, pin, delete
    user/                  profile, password, preferences, onboarding
components/
  ui/                      Button, Field, Alert, Logo, ConfirmDialog…
  landing/  auth/  chat/  sidebar/  settings/
lib/
  ai/                      provider abstraction (types, registry, adapter)
  auth/                    password hashing, sessions, route guards
  db/                      Prisma client singleton
  utils/                   markdown, highlighting, rate limiting, formatting
prisma/
  schema.prisma            User, Account, Session, Preferences, Conversation, Message
proxy.ts                   optimistic redirect for signed-out visitors
```

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
minutes, per IP *and* per address) and chat (30/minute per user). This is sized
for a single instance; behind several, either set the limits per instance or
move the store in `lib/utils/rate-limit.ts` to Redis.

---

## Deploying to Vercel

1. Push the repository and import it in Vercel.
2. Add a PostgreSQL database (Vercel Postgres, Neon or Supabase) and set
   `DATABASE_URL` to its **pooled** connection string.
3. Set the environment variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Pooled Postgres connection string |
   | `ANTHROPIC_API_KEY` | Your provider key |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |

4. Run the migrations against that database once:
   `DATABASE_URL="…" npx prisma migrate deploy`

`npm run build` runs `prisma generate` first, so the client is always built
against the current schema. `/api/chat` declares `maxDuration = 300` because a
long reply on the deepest tier can outlast the default function timeout.

---

## What is deliberately not here

Stated plainly so nothing on the site over-promises:

- **No payment processing.** The Pro and Team plans are described, and their
  buttons create an account — they do not claim to take a card. The pricing
  page says so.
- **No Google OAuth yet**, though the schema is ready for it.
- **No email sending**, so there is no password-reset flow. A user who forgets
  their password cannot currently recover the account.
- **No admin surface.** Plan changes are database updates today.
