import 'server-only'

import { redirect } from 'next/navigation'
import { getCurrentUser, type SessionUser } from './session'

/**
 * For server components behind the app shell: sends signed-out visitors to
 * login, so a page can assume there is a user without checking.
 *
 * Onboarding is deliberately NOT a gate. A new account goes straight to the
 * chat; personalising is something the user can choose to do later, not a
 * wall between them and the product.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/** For /login and /signup: a signed-in visitor has no business there. */
export async function requireGuest(): Promise<void> {
  const user = await getCurrentUser()
  if (user) redirect('/chat')
}
