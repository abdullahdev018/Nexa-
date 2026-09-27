import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

const editSchema = z.object({
  title: z
    .string()
    .max(160, 'Titles can be at most 160 characters.')
    .transform((value) => value.trim() || null)
    .nullable()
    .optional(),
  body: z.string().trim().min(1, 'This cannot be empty.').max(6000, 'This is too long.'),
})

/** A hand edit. Free — nothing is generated. */
export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const parsed = editSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const { count } = await prisma.campaignAsset.updateMany({
    where: { id, workspaceId: context.workspace.id },
    data: parsed.data,
  })
  if (count === 0) return apiError('That piece does not exist.', 404)

  const asset = await prisma.campaignAsset.findUnique({
    where: { id },
    select: { id: true, title: true, body: true, meta: true },
  })
  return NextResponse.json({ asset })
}

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const { count } = await prisma.campaignAsset.deleteMany({
    // The core sections are the campaign; only the repeatable pieces go.
    where: {
      id,
      workspaceId: context.workspace.id,
      kind: { notIn: ['STRATEGY', 'AUDIENCE_SUMMARY', 'POSITIONING', 'MARKETING_ANGLE', 'HOOK'] },
    },
  })
  if (count === 0) return apiError('That piece does not exist or cannot be removed.', 404)
  return NextResponse.json({ ok: true })
}
