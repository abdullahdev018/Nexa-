import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { creditCost } from '@/lib/billing/plans'
import { AD_PLATFORMS } from '@/lib/ads/plan'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { AdForm, type AdFormInitial } from '@/components/ads/AdForm'

export const metadata: Metadata = {
  title: 'Write ads',
  robots: { index: false, follow: false },
}

export default async function NewAdsPage(props: PageProps<'/ads/new'>) {
  const { workspace } = await requireWorkspace()
  const search = await props.searchParams

  const [products, campaigns, credits] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.campaign.findMany({
      where: { workspaceId: workspace.id, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, name: true, goal: true, productId: true },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
  ])

  // "Build ads" from a campaign arrives with ?campaign=&platform=.
  const campaign = campaigns.find((candidate) => candidate.id === search.campaign) ?? null
  const initial: AdFormInitial = {
    platform: AD_PLATFORMS.find((value) => value === search.platform) ?? 'META',
    objective: campaign?.goal ?? 'SALES',
    productId: campaign?.productId ?? null,
    campaignId: campaign?.id ?? null,
  }

  return (
    <PageBody>
      <PageHeader title="Write ads" description="Nexa writes the copy. It does not launch ads or spend money — no ad account is connected." />
      <AdForm
        products={products}
        campaigns={campaigns.map(({ id, name }) => ({ id, name }))}
        initial={initial}
        cost={creditCost('AD')}
        balance={credits.balance}
      />
    </PageBody>
  )
}
