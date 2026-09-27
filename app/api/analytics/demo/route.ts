import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { analyticsLockedError, seedDemo } from '@/lib/analytics/service'
import { apiError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

/** Loads sample numbers into the demo view — stored as DEMO, shown only there. */
export async function POST() {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)

  const locked = analyticsLockedError(context.workspace.plan)
  if (locked) return locked

  const limit = rateLimit(`analytics-demo:${context.user.id}`, 5, 60_000)
  if (!limit.ok) return apiError(`Try again in ${limit.retryAfter}s.`, 429)

  const created = await seedDemo(context.workspace.id)
  return NextResponse.json({ created }, { status: 201 })
}
