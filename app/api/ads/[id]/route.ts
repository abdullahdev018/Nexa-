import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { AD_SPECS, adIssues, matchCta, updateAdSchema, type AdPlatform } from '@/lib/ads/plan'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

const tidy = (list: string[] | undefined) =>
  list?.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)

/** Left out stays unchanged; sent empty is cleared. */
const optional = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() || null)

/**
 * A hand edit. Soft limits are left to the page's warnings; a break of a
 * platform's hard limit is refused, because saving an ad the platform will
 * reject only moves the error somewhere less helpful.
 */
export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const parsed = updateAdSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const ad = await prisma.ad.findFirst({
    where: { id, workspaceId: context.workspace.id },
    select: { id: true, platform: true, launchState: true, primaryText: true, headlines: true, descriptions: true },
  })
  if (!ad) return apiError('That ad does not exist.', 404)
  if (ad.launchState === 'LAUNCHED') return apiError('A launched ad cannot be edited.', 409)

  const platform = ad.platform as AdPlatform
  const data = {
    ...parsed.data,
    primaryText: parsed.data.primaryText?.trim(),
    headlines: tidy(parsed.data.headlines),
    descriptions: tidy(parsed.data.descriptions),
    cta: parsed.data.cta === undefined ? undefined : matchCta(platform, parsed.data.cta),
    audienceAngle: optional(parsed.data.audienceAngle),
    creativeConcept: optional(parsed.data.creativeConcept),
  }

  const errors = adIssues(platform, {
    primaryText: AD_SPECS[platform].primaryText ? (data.primaryText ?? ad.primaryText) : '',
    headlines: data.headlines ?? ad.headlines,
    descriptions: data.descriptions ?? ad.descriptions,
  }).filter((issue) => issue.severity === 'error')
  if (errors.length > 0) {
    return apiError(
      errors[0].message,
      422,
      Object.fromEntries(errors.map((issue) => [issue.index === undefined ? issue.field : `${issue.field}.${issue.index}`, issue.message])),
    )
  }

  const updated = await prisma.ad.update({
    where: { id: ad.id },
    data,
    select: { id: true, primaryText: true, headlines: true, descriptions: true, cta: true, status: true },
  })
  return NextResponse.json({ ad: updated })
}

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const { count } = await prisma.ad.deleteMany({ where: { id, workspaceId: context.workspace.id } })
  if (count === 0) return apiError('That ad does not exist.', 404)
  return NextResponse.json({ ok: true })
}
