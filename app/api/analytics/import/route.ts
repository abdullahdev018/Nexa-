import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { MAX_IMPORT_ROWS, parseImport } from '@/lib/analytics/metrics'
import { analyticsLockedError, importRows } from '@/lib/analytics/service'
import { apiError, readJson, validationError } from '@/lib/utils/api'

const importSchema = z.object({
  /** The CSV text, parsed here with the same parser the page previews with. */
  csv: z.string().min(1, 'Choose a file or paste your numbers.').max(2_000_000, 'That file is too large — keep it under 2 MB.'),
  campaignId: z.string().min(1).max(40).nullable().optional(),
})

/** Imports the user's own numbers. They are stored as IMPORTED — never as connected. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context

  const locked = analyticsLockedError(workspace.plan)
  if (locked) return locked

  const parsed = importSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  let campaignId: string | null = null
  if (parsed.data.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: parsed.data.campaignId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!campaign) return apiError('That campaign does not exist.', 404)
    campaignId = campaign.id
  }

  const { rows, errors, warnings } = parseImport(parsed.data.csv)
  if (rows.length === 0) {
    return apiError(errors[0] ?? 'No rows could be read from that file.', 422)
  }
  const imported = await importRows(workspace.id, rows.slice(0, MAX_IMPORT_ROWS), campaignId)
  return NextResponse.json(
    { imported, skipped: errors.slice(0, 20), skippedCount: errors.length, warnings: warnings.slice(0, 20) },
    { status: 201 },
  )
}
