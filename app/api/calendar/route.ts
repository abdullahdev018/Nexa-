import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { calendarLockedError } from '@/lib/calendar/api'
import { createItemSchema } from '@/lib/calendar/plan'
import { createItem } from '@/lib/calendar/service'
import { apiError, readJson, validationError } from '@/lib/utils/api'

/** Plans one item, or puts a content piece on the calendar. Posts nothing. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)

  const locked = calendarLockedError(context.workspace.plan)
  if (locked) return locked

  const parsed = createItemSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const outcome = await createItem(parsed.data, context.workspace.id)
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json({ item: { id: outcome.id } }, { status: 201 })
}
