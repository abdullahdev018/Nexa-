/**
 * Creates a demo account with a couple of conversations, so a fresh database
 * has something to look at.
 *
 *   npm run db:seed
 *
 * Run through tsx rather than node: the generated Prisma client imports its
 * own modules without file extensions, which Node's type stripping cannot
 * resolve.
 *
 * Safe to re-run: the account is upserted by email and its conversations are
 * replaced rather than duplicated. It refuses to run against a production
 * database — seeding one would put a known password on a live system.
 */

import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../lib/generated/prisma/client'

const DEMO_EMAIL = 'demo@nexa.local'
const DEMO_PASSWORD = 'demopass123'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.')
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      role: 'Product engineer at a small SaaS company',
      useCases: ['Coding and debugging', 'Writing and editing'],
      onboardedAt: new Date(),
      accounts: {
        create: { provider: 'credentials', providerAccountId: DEMO_EMAIL, passwordHash },
      },
      preferences: {
        create: {
          defaultModel: 'nexa-balanced',
          customInstructions: 'Be concise. Prefer TypeScript examples.',
        },
      },
    },
    select: { id: true },
  })

  // Every account owns a workspace — that is the tenancy root, and nothing
  // can be created without one.
  //
  // The demo workspace is put on PRO so the seeded account can exercise the
  // paid features locally. Its Subscription row leaves `provider` null, which
  // is what records the truth: this plan was GRANTED by the seed, not paid
  // for. Nothing in the app may read it as a completed purchase.
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  })

  if (!workspace) {
    const now = new Date()
    workspace = await prisma.workspace.create({
      data: {
        name: 'Demo Workspace',
        slug: `demo-${user.id.slice(-8).toLowerCase()}`,
        ownerId: user.id,
        plan: 'PRO',
        memberships: { create: { userId: user.id, role: 'OWNER' } },
        subscription: { create: { plan: 'PRO', status: 'ACTIVE', interval: 'MONTHLY' } },
        creditBalance: {
          create: {
            balance: 2000,
            monthlyAllowance: 2000,
            periodStart: now,
            periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      select: { id: true },
    })

    await prisma.creditTransaction.create({
      data: {
        workspaceId: workspace.id,
        amount: 2000,
        kind: 'GRANT',
        reason: 'Opening balance',
        balanceAfter: 2000,
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastWorkspaceId: workspace.id },
    })
  }

  // Replaced rather than appended, so repeated runs do not pile up.
  await prisma.conversation.deleteMany({ where: { userId: user.id } })

  await prisma.conversation.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      title: 'Refactor the session check',
      model: 'nexa-balanced',
      pinned: true,
      messages: {
        create: [
          {
            role: 'USER',
            content: 'Can you review this session check and suggest improvements?',
          },
          {
            role: 'ASSISTANT',
            model: 'nexa-balanced',
            content: [
              'Two things stand out, and one of them is a real bug.',
              '',
              '## The bug',
              '',
              'The expiry comparison uses `<` rather than `<=`, so a session expiring on this exact millisecond is still accepted:',
              '',
              '```ts',
              'if (session.expiresAt.getTime() < Date.now()) return null',
              '```',
              '',
              'Use `<=` so the boundary case fails closed.',
              '',
              '## Worth changing',
              '',
              '| Issue | Why it matters |',
              '| --- | --- |',
              '| Token compared with `===` | Leaks length via timing; use a constant-time compare |',
              '| No sliding expiry | An active user is signed out mid-session |',
              '',
              '> Neither is urgent, but the first is cheap to fix.',
            ].join('\n'),
          },
        ],
      },
    },
  })

  await prisma.conversation.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      title: 'Launch announcement draft',
      model: 'nexa-swift',
      messages: {
        create: [
          { role: 'USER', content: 'Draft a short launch announcement for our new billing page.' },
          {
            role: 'ASSISTANT',
            model: 'nexa-swift',
            content:
              'Here is a first pass, kept to one paragraph so it works as a changelog entry and a social post:\n\n**Billing, rebuilt.** You can now see every invoice, change plan, and update payment details from one page — no more emailing support to switch tiers. Existing plans carry over automatically.\n\nWant a longer version for the blog, or a shorter one for the in-app banner?',
          },
        ],
      },
    },
  })

  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}) with 2 conversations.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
