import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { campaignBriefSchema } from '@/lib/campaigns/options'
import { resolveBrief } from '@/lib/campaigns/brief'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the campaign a name.').max(120).optional(),
    /**
     * What the user says about the campaign. ACTIVE means "I am running
     * this" — Nexa publishes nothing, and the page says so.
     */
    status: z.enum(['READY', 'ACTIVE', 'ARCHIVED']).optional(),
  })
  .refine((value) => value.name !== undefined || value.status !== undefined, 'Nothing to change.')

/** Renames, marks live, archives or restores. */
export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context
  const { id } = await params

  const parsed = patchSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, status: true, generatedAt: true },
  })
  if (!campaign) return apiError('That campaign does not exist.', 404)
  if (campaign.status === 'GENERATING' && parsed.data.status) {
    return apiError('Wait for the campaign to finish generating.', 409)
  }

  let status: 'DRAFT' | 'READY' | 'ACTIVE' | 'ARCHIVED' | undefined = parsed.data.status
  if (status === 'ACTIVE' && !campaign.generatedAt) {
    return apiError('Generate the campaign before marking it live.', 422)
  }
  // Restoring something never generated returns it to a draft, not "ready".
  if (status === 'READY' && !campaign.generatedAt) status = 'DRAFT'

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { name: parsed.data.name, status },
    select: { id: true, name: true, status: true },
  })
  return NextResponse.json({ campaign: updated })
}

/** Replaces the brief. The existing plan stays until the user regenerates. */
export async function PUT(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context
  const { id } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, status: true },
  })
  if (!campaign) return apiError('That campaign does not exist.', 404)
  if (campaign.status === 'GENERATING') {
    return apiError('Wait for the campaign to finish generating.', 409)
  }

  const parsed = campaignBriefSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const resolved = await resolveBrief(parsed.data, workspace.id)
  if (!resolved.ok) {
    return apiError(resolved.message, resolved.status, resolved.field ? { [resolved.field]: resolved.message } : undefined)
  }

  // The workspace column is never changed by an edit.
  const fields: Partial<typeof resolved.data> = { ...resolved.data }
  delete fields.workspaceId
  await prisma.campaign.update({ where: { id: campaign.id }, data: fields })
  return NextResponse.json({ campaign: { id: campaign.id } })
}

/** Deletes the campaign and its pieces. Content made from it is kept. */
export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const { count } = await prisma.campaign.deleteMany({
    where: { id, workspaceId: context.workspace.id, status: { not: 'GENERATING' } },
  })
  if (count === 0) {
    const exists = await prisma.campaign.count({ where: { id, workspaceId: context.workspace.id } })
    return exists
      ? apiError('Wait for the campaign to finish generating.', 409)
      : apiError('That campaign does not exist.', 404)
  }
  return NextResponse.json({ ok: true })
}
