import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

export const metadata: Metadata = {
  title: 'Set up your account',
  robots: { index: false, follow: false },
}

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/onboarding')
  // Onboarding is a one-time step; re-entering it after finishing would only
  // overwrite settings the user has since changed.
  if (user.onboardedAt) redirect('/chat')

  return <OnboardingFlow name={user.name} />
}
