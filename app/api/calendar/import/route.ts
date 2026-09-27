import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { calendarLockedError } from '@/lib/calendar/api'
import { importCampaign } from '@/lib/calendar/service'
import { apiError, readJson, validationError } from '@/lib/utils/api'

const importSchema = z.object({
  campaignId: z.string().min(1).max(40),
  start: z.coerce.date('Choose a start date.').refine((date) => !Number.isNaN(date.getTime()), 'Choose a start date.'),
  again: z.boolean().optional().default(false),
})

/** Adds a campaign's calendar from a start date. Free — nothing is generated. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)

  const locked = calendarLockedError(context.workspace.plan)
  if (locked) return locked

  const parsed = importSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const outcome = await importCampaign(parsed.data, context.workspace.id)
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome, { status: 201 })
}
