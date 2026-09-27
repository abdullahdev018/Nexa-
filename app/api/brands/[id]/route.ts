import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { BRAND_SELECT, lockedKitFields, toBrandProfile, updateBrandSchema } from '@/lib/brand/schema'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { kitLockedError } from '@/lib/brand/api'

interface Context {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context
  const { id } = await params

  const parsed = updateBrandSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const locked = lockedKitFields(parsed.data, workspace.plan)
  if (locked.length > 0) return kitLockedError(locked, workspace.plan)

  const { isDefault, ...fields } = parsed.data

  const brand = await prisma.$transaction(async (tx) => {
    // Scoped by workspace as well as id, so another tenant's id updates nothing.
    const { count } = await tx.brand.updateMany({
      where: { id, workspaceId: workspace.id },
      data: fields,
    })
    if (count === 0) return null

    if (isDefault) {
      await tx.brand.updateMany({
        where: { workspaceId: workspace.id, id: { not: id } },
        data: { isDefault: false },
      })
      await tx.brand.update({ where: { id }, data: { isDefault: true } })
    }

    return tx.brand.findUnique({ where: { id }, select: BRAND_SELECT })
  })

  if (!brand) return apiError('That brand does not exist.', 404)
  return NextResponse.json({ brand: toBrandProfile(brand) })
}

/**
 * Deletes a brand and its products. Campaigns and content made with it are
 * kept — they are the user's work — and simply stop pointing at a brand.
 */
export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context
  const { id } = await params

  const deleted = await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.findFirst({
      where: { id, workspaceId: workspace.id },
      select: { id: true, isDefault: true },
    })
    if (!brand) return false

    await tx.product.deleteMany({ where: { brandId: brand.id, workspaceId: workspace.id } })
    await tx.brand.delete({ where: { id: brand.id } })

    // Never leave a workspace with brands but no default.
    if (brand.isDefault) {
      const next = await tx.brand.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (next) await tx.brand.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return true
  })

  if (!deleted) return apiError('That brand does not exist.', 404)
  return NextResponse.json({ ok: true })
}
