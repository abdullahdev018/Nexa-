import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/guards'
import { LinkButton } from '@/components/ui/Button'
import { PageHeader, SettingsSection } from '@/components/settings/PageHeader'
import {
  DangerZone,
  PasswordForm,
  ProfileForm,
} from '@/components/settings/AccountForms'
import { ThemeControl } from '@/components/settings/ThemeControl'
import { DEFAULT_THEME, isTheme } from '@/lib/theme'
import { formatDate } from '@/lib/utils/format'

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
}

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
}

export default async function AccountPage() {
  const user = await requireUser()

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      plan: true,
      role: true,
      useCases: true,
      createdAt: true,
      preferences: { select: { theme: true } },
      _count: { select: { conversations: true } },
    },
  })

  if (!account) return null

  return (
    <div className="scroll-subtle h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <PageHeader title="Account" description="Your profile, plan and sign-in details." />

        <SettingsSection title="Profile">
          <ProfileForm name={account.name ?? ''} email={account.email} />
        </SettingsSection>

        <SettingsSection
          title="Appearance"
          description="Applies straight away, on every device you sign in from."
        >
          <ThemeControl
            initial={isTheme(account.preferences?.theme) ? account.preferences.theme : DEFAULT_THEME}
          />
        </SettingsSection>

        <SettingsSection title="Plan">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-200 bg-ink-50 p-5">
            <div>
              <p className="text-[15px] font-semibold text-ink-900">
                {PLAN_LABEL[account.plan] ?? account.plan} plan
              </p>
              <p className="mt-1 text-[14px] text-ink-600">
                Member since {formatDate(account.createdAt)} ·{' '}
                {account._count.conversations === 1
                  ? '1 conversation'
                  : `${account._count.conversations} conversations`}
              </p>
            </div>
            {account.plan === 'FREE' && (
              <LinkButton href="/pricing" size="sm">
                Upgrade to Pro
              </LinkButton>
            )}
          </div>

          {(account.role || account.useCases.length > 0) && (
            <dl className="mt-5 space-y-3 text-[14px]">
              {account.role && (
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-ink-500">Role</dt>
                  <dd className="text-ink-800">{account.role}</dd>
                </div>
              )}
              {account.useCases.length > 0 && (
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-ink-500">Uses Nexa for</dt>
                  <dd className="text-ink-800">{account.useCases.join(', ')}</dd>
                </div>
              )}
            </dl>
          )}

          <p className="mt-4 text-[13px] text-ink-500">
            Change what Nexa knows about your work in{' '}
            <Link href="/settings" className="underline underline-offset-2 hover:text-ink-800">
              Settings
            </Link>
            .
          </p>
        </SettingsSection>

        <SettingsSection
          title="Password"
          description="Changing your password signs out every other device."
        >
          <PasswordForm />
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <DangerZone conversationCount={account._count.conversations} />
        </SettingsSection>
      </div>
    </div>
  )
}
