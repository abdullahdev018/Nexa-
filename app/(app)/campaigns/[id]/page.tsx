import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { creditCost, planAllows } from '@/lib/billing/plans'
import {
  GOAL_OPTIONS,
  PLATFORM_LABEL,
  STYLE_OPTIONS,
  isGenerationStale,
} from '@/lib/campaigns/options'
import type { AssetKind, AssetMeta } from '@/lib/campaigns/plan'
import { PageBody } from '@/components/app/PageHeader'
import { CampaignWorkspace } from '@/components/campaigns/CampaignWorkspace'
import { StatusBadge } from '@/components/campaigns/StatusBadge'

export const metadata: Metadata = {
  title: 'Campaign',
  robots: { index: false, follow: false },
}

/** The order sections read in, matching the page. */
const KIND_ORDER: AssetKind[] = [
  'STRATEGY',
  'AUDIENCE_SUMMARY',
  'POSITIONING',
  'MARKETING_ANGLE',
  'HOOK',
  'ALT_HOOK',
  'CONTENT_IDEA',
  'VIDEO_CONCEPT',
  'AD_COPY',
  'SOCIAL_CAPTION',
  'CTA',
  'CONTENT_CALENDAR',
]

export default async function CampaignPage(props: PageProps<'/campaigns/[id]'>) {
  const { workspace } = await requireWorkspace()
  const { id } = await props.params
  const search = await props.searchParams

  const [campaign, credits] = await Promise.all([
    // Scoped by workspace as well as id: another tenant's campaign is a 404.
    prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
      select: {
        id: true,
        name: true,
        status: true,
        goal: true,
        style: true,
        platforms: true,
        generatedAt: true,
        updatedAt: true,
        lastError: true,
        audienceAgeRange: true,
        audienceLocation: true,
        audienceCustomerType: true,
        product: { select: { name: true } },
        brand: { select: { id: true, name: true } },
        assets: {
          orderBy: { position: 'asc' },
          select: { id: true, kind: true, title: true, body: true, meta: true },
        },
      },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
  ])
  if (!campaign) notFound()

  const stale = isGenerationStale(campaign.status, campaign.updatedAt)
  const status = stale ? (campaign.generatedAt ? 'READY' : 'DRAFT') : campaign.status
  const assets = [...campaign.assets]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map((asset) => ({ ...asset, meta: asset.meta as AssetMeta | null }))

  const facts = [
    campaign.product?.name,
    GOAL_OPTIONS[campaign.goal].label,
    STYLE_OPTIONS[campaign.style].label,
    campaign.platforms.map((platform) => PLATFORM_LABEL[platform]).join(', '),
  ].filter(Boolean)

  return (
    <PageBody wide>
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink-500">
        <Link href="/campaigns" className="hover:text-ink-800 hover:underline">
          Campaigns
        </Link>
      </nav>
      <div className="pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900 sm:text-[26px]">{campaign.name}</h1>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1.5 text-[14px] text-ink-600">{facts.join(' · ')}</p>
        <p className="mt-1 text-[13px] text-ink-500">
          {campaign.brand ? (
            <>
              Written for{' '}
              <Link href={`/brand/${campaign.brand.id}`} className="font-medium text-ink-700 hover:underline">
                {campaign.brand.name}
              </Link>
            </>
          ) : (
            'No brand attached'
          )}
          {campaign.generatedAt &&
            ` · Generated ${campaign.generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
        </p>
      </div>

      <CampaignWorkspace
        // Remount when a generation lands, so no card holds a stale edit.
        key={campaign.generatedAt?.toISOString() ?? 'draft'}
        campaign={{
          id: campaign.id,
          name: campaign.name,
          status,
          stale,
          generatedAt: campaign.generatedAt?.toISOString() ?? null,
          generatingSince: campaign.status === 'GENERATING' ? campaign.updatedAt.toISOString() : null,
          lastError: campaign.lastError,
        }}
        assets={assets}
        campaignCost={creditCost('CAMPAIGN')}
        itemCost={creditCost('CONTENT')}
        balance={credits.balance}
        autoGenerate={search.generate === '1'}
        calendarAllowed={planAllows(workspace.plan, 'contentCalendar')}
      />
    </PageBody>
  )
}
