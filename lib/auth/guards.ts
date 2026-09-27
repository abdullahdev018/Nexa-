import 'server-only'

import { redirect } from 'next/navigation'
import { getCurrentUser } from './session'

/**
 * Signed-in routes use `requireWorkspace()` from ./workspace instead: every
 * page behind the app shell needs to know which workspace it is acting in,
 * and that guard returns the user as well. This file is now only the guest
 * gate.
 */

/** For /login and /signup: a signed-in visitor has no business there. */
export async function requireGuest(): Promise<void> {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')
}
