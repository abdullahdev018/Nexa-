import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { MAX_PRODUCTS_PER_BRAND, PRODUCT_SELECT, createProductSchema } from '@/lib/brand/schema'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context
  const { id: brandId } = await params

  const parsed = createProductSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const result = await prisma.$transaction(async (tx) => {
    // Locking the brand row serialises concurrent adds, so the cap holds.
    const locked = await tx.$executeRaw`
      SELECT 1 FROM "Brand" WHERE "id" = ${brandId} AND "workspaceId" = ${workspace.id} FOR UPDATE`
    if (locked === 0) return 'missing' as const

    const existing = await tx.product.count({ where: { brandId, workspaceId: workspace.id } })
    if (existing >= MAX_PRODUCTS_PER_BRAND) return 'full' as const

    return tx.product.create({
      data: { ...parsed.data, brandId, workspaceId: workspace.id },
      select: PRODUCT_SELECT,
    })
  })

  if (result === 'missing') return apiError('That brand does not exist.', 404)
  if (result === 'full') {
    return apiError(`A brand can hold up to ${MAX_PRODUCTS_PER_BRAND} products.`, 422)
  }
  return NextResponse.json({ product: result }, { status: 201 })
}
