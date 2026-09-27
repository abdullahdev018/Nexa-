import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canAfford } from '@/lib/billing/credits'
import { calendarLockedError } from '@/lib/calendar/api'
import { generateCalendarSchema } from '@/lib/calendar/plan'
import { generateCalendar } from '@/lib/calendar/service'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

export const maxDuration = 180

/** Plans weeks of posts with the model. Saves them as drafts; posts nothing. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context

  const locked = calendarLockedError(workspace.plan)
  if (locked) return locked

  const limit = rateLimit(`calendar:${user.id}`, 6, 60_000)
  if (!limit.ok) return apiError(`Too many generations at once. Try again in ${limit.retryAfter}s.`, 429)

  const parsed = generateCalendarSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  if (!getProvider().configured) {
    return apiError('Nexa is not connected to an AI provider yet, so nothing can be generated.', 503)
  }

  const affordable = await canAfford(workspace.id, workspace.plan, 'CALENDAR')
  if (!affordable.ok) {
    return apiError(
      `Not enough credits. Planning a calendar costs ${affordable.required} and the workspace has ${affordable.balance} left.`,
      402,
    )
  }

  const label =
    parsed.data.startLabel ||
    parsed.data.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const outcome = await generateCalendar(parsed.data, label, { workspaceId: workspace.id, plan: workspace.plan, userId: user.id })
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome, { status: 201 })
}
