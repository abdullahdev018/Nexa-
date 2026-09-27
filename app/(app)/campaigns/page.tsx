import type { Metadata } from 'next'
import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { GOAL_OPTIONS, PLATFORM_LABEL, isGenerationStale } from '@/lib/campaigns/options'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { WorkflowStrip } from '@/components/dashboard/WorkflowStrip'
import { StatusBadge } from '@/components/campaigns/StatusBadge'

export const metadata: Metadata = {
  title: 'Campaigns',
  robots: { index: false, follow: false },
}

export default async function CampaignsPage() {
  const { workspace } = await requireWorkspace()

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      platforms: true,
      updatedAt: true,
      lastError: true,
      product: { select: { name: true } },
      _count: { select: { assets: true } },
    },
  })

  const active = campaigns.filter((campaign) => campaign.status !== 'ARCHIVED')
  const archived = campaigns.filter((campaign) => campaign.status === 'ARCHIVED')

  return (
    <PageBody wide>
      <PageHeader
        title="Campaigns"
        description="Turn one product brief into a complete marketing campaign."
        actions={
          campaigns.length > 0 ? (
            <LinkButton href="/campaigns/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New campaign
            </LinkButton>
          ) : null
        }
      />

      {campaigns.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Pick a product, a goal and where you sell. Nexa writes the strategy, hooks, content, video concepts, ad copy and a two-week calendar."
            action={
              <LinkButton href="/campaigns/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create your first campaign
              </LinkButton>
            }
          />
          <WorkflowStrip />
        </div>
      ) : (
        <div className="space-y-8">
          <CampaignList campaigns={active} />
          {archived.length > 0 && (
            <section>
              <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-500">Archived</h2>
              <CampaignList campaigns={archived} />
            </section>
          )}
        </div>
      )}
    </PageBody>
  )
}

function CampaignList({
  campaigns,
}: {
  campaigns: {
    id: string
    name: string
    goal: keyof typeof GOAL_OPTIONS
    status: 'DRAFT' | 'GENERATING' | 'READY' | 'ACTIVE' | 'ARCHIVED'
    platforms: (keyof typeof PLATFORM_LABEL)[]
    updatedAt: Date
    lastError: string | null
    product: { name: string } | null
    _count: { assets: number }
  }[]
}) {
  if (campaigns.length === 0) return null

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {campaigns.map((campaign) => {
        // A generation the server gave up on reads as what it now is: a draft.
        const status =
          isGenerationStale(campaign.status, campaign.updatedAt) ? 'DRAFT' : campaign.status
        return (
          <li key={campaign.id}>
            <Link
              href={`/campaigns/${campaign.id}`}
              className="block h-full rounded-xl border border-ink-200 bg-raised p-4 shadow-xs transition-colors hover:border-ink-300 hover:bg-ink-50"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-[15px] font-semibold text-ink-900">{campaign.name}</h3>
                <StatusBadge status={status} />
              </div>
              <p className="mt-1 text-[13px] text-ink-600">
                {[campaign.product?.name, GOAL_OPTIONS[campaign.goal].label].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-3 text-[12.5px] text-ink-500">
                {campaign.platforms.map((platform) => PLATFORM_LABEL[platform]).join(', ')}
                {' · '}
                {campaign._count.assets > 0
                  ? `${campaign._count.assets} pieces`
                  : campaign.lastError
                    ? 'Last generation failed'
                    : 'Not generated yet'}
                {' · '}
                Updated {campaign.updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
