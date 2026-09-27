import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getPlan, planLimit } from '@/lib/billing/plans'
import { BRAND_SELECT, createBrandSchema, lockedKitFields, toBrandProfile } from '@/lib/brand/schema'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { kitLockedError } from '@/lib/brand/api'

export async function GET() {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)

  const brands = await prisma.brand.findMany({
    where: { workspaceId: context.workspace.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: BRAND_SELECT,
  })

  return NextResponse.json({ brands: brands.map(toBrandProfile) })
}

export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context

  const parsed = createBrandSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const locked = lockedKitFields(parsed.data, workspace.plan)
  if (locked.length > 0) return kitLockedError(locked, workspace.plan)

  const limit = planLimit(workspace.plan, 'brands')

  const brand = await prisma.$transaction(async (tx) => {
    // Locks the workspace row first, so two quick submits are counted one
    // after the other and cannot both squeeze under the limit.
    await tx.$executeRaw`SELECT 1 FROM "Workspace" WHERE "id" = ${workspace.id} FOR UPDATE`

    const existing = await tx.brand.count({ where: { workspaceId: workspace.id } })
    if (existing >= limit) return null

    return tx.brand.create({
      data: {
        ...parsed.data,
        workspaceId: workspace.id,
        // The first brand is the one generations use without being told.
        isDefault: existing === 0,
      },
      select: BRAND_SELECT,
    })
  })

  if (!brand) {
    const plan = getPlan(workspace.plan)
    return apiError(
      `The ${plan.name} plan includes ${limit} brand${limit === 1 ? '' : 's'}, and this ` +
        'workspace has reached it. Upgrade to add another, or edit an existing brand.',
      403,
    )
  }

  return NextResponse.json({ brand: toBrandProfile(brand) }, { status: 201 })
}
