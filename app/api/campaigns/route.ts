import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { planAllows } from '@/lib/billing/plans'
import { campaignBriefSchema } from '@/lib/campaigns/options'
import { resolveBrief } from '@/lib/campaigns/brief'
import { apiError, readJson, validationError } from '@/lib/utils/api'

export async function GET() {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: context.workspace.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, goal: true, status: true, generatedAt: true, updatedAt: true },
  })
  return NextResponse.json({ campaigns })
}

/** Saves a brief as a draft. Generating it is a separate, paid step. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context

  if (!planAllows(workspace.plan, 'campaignBuilder')) {
    return apiError('The campaign builder is not included on your plan.', 403)
  }

  const parsed = campaignBriefSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const resolved = await resolveBrief(parsed.data, workspace.id)
  if (!resolved.ok) {
    return apiError(resolved.message, resolved.status, resolved.field ? { [resolved.field]: resolved.message } : undefined)
  }

  const campaign = await prisma.campaign.create({
    data: { ...resolved.data, createdById: user.id },
    select: { id: true },
  })
  return NextResponse.json({ campaign }, { status: 201 })
}
