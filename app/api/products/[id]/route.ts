import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { PRODUCT_SELECT, productFieldsSchema } from '@/lib/brand/schema'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { workspace } = context
  const { id } = await params

  const parsed = productFieldsSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const { count } = await prisma.product.updateMany({
    where: { id, workspaceId: workspace.id },
    data: parsed.data,
  })
  if (count === 0) return apiError('That product does not exist.', 404)

  const product = await prisma.product.findUnique({ where: { id }, select: PRODUCT_SELECT })
  return NextResponse.json({ product })
}

/** Campaigns and videos made for the product are kept and stop pointing at it. */
export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const { count } = await prisma.product.deleteMany({
    where: { id, workspaceId: context.workspace.id },
  })
  if (count === 0) return apiError('That product does not exist.', 404)
  return NextResponse.json({ ok: true })
}
