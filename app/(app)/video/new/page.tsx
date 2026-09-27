import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { creditCost, planAllows } from '@/lib/billing/plans'
import type { AssetMeta } from '@/lib/campaigns/plan'
import { VIDEO_PLATFORMS } from '@/lib/video/plan'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { PlanLock } from '@/components/app/PlanLock'
import { VideoForm, type VideoFormInitial } from '@/components/video/VideoForm'

export const metadata: Metadata = {
  title: 'New video plan',
  robots: { index: false, follow: false },
}

export default async function NewVideoPage(props: PageProps<'/video/new'>) {
  const { workspace } = await requireWorkspace()

  if (!planAllows(workspace.plan, 'videoGeneration')) {
    return (
      <PageBody>
        <PageHeader title="New video plan" />
        <PlanLock plan={workspace.plan} feature="videoGeneration" what="AI video planning" />
      </PageBody>
    )
  }

  const search = await props.searchParams
  const [products, campaigns, credits] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.campaign.findMany({
      where: { workspaceId: workspace.id, generatedAt: { not: null }, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        productId: true,
        assets: {
          where: { kind: 'VIDEO_CONCEPT' },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, meta: true },
        },
      },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
  ])

  const formCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    concepts: campaign.assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      platform: (asset.meta as AssetMeta | null)?.platform ?? null,
    })),
  }))

  // "Plan this video" from a campaign arrives with ?campaign=&concept=.
  const campaign = campaigns.find((candidate) => candidate.id === search.campaign) ?? null
  const concept = formCampaigns
    .find((candidate) => candidate.id === campaign?.id)
    ?.concepts.find((candidate) => candidate.id === search.concept) ?? null

  const initial: VideoFormInitial = {
    type: 'PRODUCT_SHOWCASE',
    platform: concept?.platform && VIDEO_PLATFORMS.includes(concept.platform) ? concept.platform : 'TIKTOK',
    durationSeconds: 30,
    productId: campaign?.productId ?? null,
    campaignId: campaign?.id ?? null,
    conceptId: concept?.id ?? null,
  }

  return (
    <PageBody>
      <PageHeader
        title="New video plan"
        description="Nexa writes a plan you can film. It does not render video — no video provider is connected."
      />
      <VideoForm
        products={products}
        campaigns={formCampaigns}
        initial={initial}
        cost={creditCost('VIDEO_PLAN')}
        balance={credits.balance}
      />
    </PageBody>
  )
}
