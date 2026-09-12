import 'server-only'

import { redirect } from 'next/navigation'
import { getCurrentUser, type SessionUser } from './session'

/**
 * For server components behind the app shell. Sends signed-out visitors to
 * login, and anyone who has not finished onboarding to onboarding — so a page
 * can assume both are true without checking.
 */
export async function requireUser(options: { onboarded?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (options.onboarded !== false && !user.onboardedAt) redirect('/onboarding')
  return user
}

/** For /login and /signup: a signed-in visitor has no business there. */
export async function requireGuest(): Promise<void> {
  const user = await getCurrentUser()
  if (user) redirect(user.onboardedAt ? '/chat' : '/onboarding')
}
