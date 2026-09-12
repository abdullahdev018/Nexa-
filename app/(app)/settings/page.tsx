import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/guards'
import { DEFAULT_MODEL_ID } from '@/lib/ai/models'
import { PageHeader } from '@/components/settings/PageHeader'
import { SettingsForm } from '@/components/settings/SettingsForm'
import type { UserPreferences } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
}

export default async function SettingsPage() {
  const user = await requireUser()

  const stored = await prisma.preferences.findUnique({
    where: { userId: user.id },
    select: {
      defaultModel: true,
      customInstructions: true,
      theme: true,
      enterToSend: true,
    },
  })

  // A user created before preferences existed still gets sensible defaults
  // rather than an empty form.
  const preferences: UserPreferences = {
    defaultModel: stored?.defaultModel ?? DEFAULT_MODEL_ID,
    customInstructions: stored?.customInstructions ?? null,
    theme: stored?.theme ?? 'SYSTEM',
    enterToSend: stored?.enterToSend ?? true,
  }

  return (
    <div className="scroll-subtle h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <PageHeader
          title="Settings"
          description="How Nexa behaves for you. These apply to every conversation."
        />
        <SettingsForm preferences={preferences} plan={user.plan} />
      </div>
    </div>
  )
}
