import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { creditCost } from '@/lib/billing/plans'
import { PLATFORMS, type Platform } from '@/lib/campaigns/options'
import type { AssetMeta } from '@/lib/campaigns/plan'
import { PLATFORM_FORMATS, isValidCombination } from '@/lib/studio/options'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { ContentComposer, type ComposerInitial } from '@/components/studio/ContentComposer'

export const metadata: Metadata = {
  title: 'Create content',
  robots: { index: false, follow: false },
}

export default async function NewContentPage(props: PageProps<'/content/new'>) {
  const { workspace } = await requireWorkspace()
  const search = await props.searchParams

  const [campaigns, brands, credits] = await Promise.all([
    prisma.campaign.findMany({
      // Only campaigns with a plan have ideas and strategy worth building from.
      where: { workspaceId: workspace.id, generatedAt: { not: null }, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        platforms: true,
        assets: {
          where: { kind: 'CONTENT_IDEA' },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, body: true, meta: true },
        },
      },
    }),
    prisma.brand.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
  ])

  const composerCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    platforms: campaign.platforms,
    ideas: campaign.assets.map((asset) => {
      const meta = asset.meta as AssetMeta | null
      return {
        id: asset.id,
        title: asset.title,
        body: asset.body,
        platform: meta?.platform ?? null,
        format: meta?.format ?? null,
      }
    }),
  }))

  // "Create content" from a campaign's idea arrives with ?campaign=&idea=.
  const campaign = composerCampaigns.find((candidate) => candidate.id === search.campaign) ?? null
  const idea = campaign?.ideas.find((candidate) => candidate.id === search.idea) ?? null
  const requestedPlatform = PLATFORMS.find((value) => value === search.platform)
  const platform: Platform = idea?.platform ?? requestedPlatform ?? campaign?.platforms[0] ?? 'INSTAGRAM'
  const format = idea?.format && isValidCombination(platform, idea.format) ? idea.format : PLATFORM_FORMATS[platform][0]

  const initial: ComposerInitial = {
    platform,
    format,
    topic: idea ? [idea.title, idea.body].filter(Boolean).join(': ').slice(0, 1000) : '',
    campaignId: campaign?.id ?? null,
    ideaId: idea?.id ?? null,
  }

  return (
    <PageBody>
      <PageHeader title="Create content" description="Choose where it goes and what it is about. Nexa writes it in your brand's voice." />
      <ContentComposer
        campaigns={composerCampaigns}
        brands={brands}
        initial={initial}
        cost={creditCost('CONTENT')}
        balance={credits.balance}
      />
    </PageBody>
  )
}
