import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Megaphone, Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { creditCost } from '@/lib/billing/plans'
import { AD_SPECS, type AdPlatform } from '@/lib/ads/plan'
import { adLaunching } from '@/lib/ads/launch'
import { LinkButton } from '@/components/ui/Button'
import { PageBody } from '@/components/app/PageHeader'
import { AdCard } from '@/components/ads/AdCard'
import { AdSetDownload } from '@/components/ads/AdSetDownload'

export const metadata: Metadata = {
  title: 'Ads',
  robots: { index: false, follow: false },
}

const SELECT = {
  id: true,
  platform: true,
  primaryText: true,
  headlines: true,
  descriptions: true,
  cta: true,
  audienceAngle: true,
  creativeConcept: true,
  status: true,
  variantGroup: true,
  createdAt: true,
  campaign: { select: { id: true, name: true } },
} as const

/** A set of ads written together. */
export default async function AdSetPage(props: PageProps<'/ads/[id]'>) {
  const { workspace } = await requireWorkspace()
  const { id } = await props.params

  const ad = await prisma.ad.findFirst({ where: { id, workspaceId: workspace.id }, select: SELECT })
  if (!ad) notFound()

  const set = ad.variantGroup
    ? await prisma.ad.findMany({
        where: { variantGroup: ad.variantGroup, workspaceId: workspace.id },
        orderBy: { createdAt: 'asc' },
        select: SELECT,
      })
    : [ad]

  const platform = ad.platform as AdPlatform
  const spec = AD_SPECS[platform]
  const sibling = set.find((piece) => piece.id !== ad.id)
  const views = set.map((piece) => ({ ...piece, platform }))

  return (
    <PageBody wide>
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink-500">
        <Link href="/ads" className="hover:text-ink-800 hover:underline">
          Ad Studio
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
            {spec.label} · {spec.format}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-600">
            {set.length} ad{set.length === 1 ? '' : 's'}
            {ad.campaign && (
              <>
                {' · '}
                <Link href={`/campaigns/${ad.campaign.id}`} className="font-medium text-ink-800 hover:underline">
                  {ad.campaign.name}
                </Link>
              </>
            )}
            {' · '}Written {ad.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <AdSetDownload platform={platform} ads={views} name={`${spec.label}-ads`} />
          <LinkButton href="/ads/new" size="sm" variant="secondary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Write more
          </LinkButton>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
        <p className="text-[13.5px] leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Not launched.</span> {adLaunching().explanation}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {views.map((view, index) => (
          <AdCard
            key={view.id}
            ad={view}
            index={index}
            total={set.length}
            cost={creditCost('AD')}
            afterDeleteHref={view.id === ad.id ? (sibling ? `/ads/${sibling.id}` : '/ads') : undefined}
          />
        ))}
      </div>
    </PageBody>
  )
}
