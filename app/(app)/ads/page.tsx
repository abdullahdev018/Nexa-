import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Target } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { AD_SPECS, type AdPlatform } from '@/lib/ads/plan'
import { adLaunching } from '@/lib/ads/launch'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageBody, PageHeader } from '@/components/app/PageHeader'

export const metadata: Metadata = {
  title: 'Ad Studio',
  robots: { index: false, follow: false },
}

export default async function AdsPage() {
  const { workspace } = await requireWorkspace()

  const ads = await prisma.ad.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true,
      platform: true,
      variantGroup: true,
      primaryText: true,
      headlines: true,
      status: true,
      createdAt: true,
      campaign: { select: { name: true } },
    },
  })

  // One card per set: ads written together share a variant group.
  const sets = new Map<string, typeof ads>()
  for (const ad of ads) {
    const key = ad.variantGroup ?? ad.id
    sets.set(key, [...(sets.get(key) ?? []), ad])
  }

  return (
    <PageBody wide>
      <PageHeader
        title="Ad Studio"
        description="Ad copy for Meta, Google and TikTok, written to each platform's limits."
        actions={
          ads.length > 0 ? (
            <LinkButton href="/ads/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Write ads
            </LinkButton>
          ) : null
        }
      />
      <p className="mb-6 text-[13px] text-ink-500">{adLaunching().explanation}</p>

      {sets.size === 0 ? (
        <EmptyState
          icon={Target}
          title="No ads yet"
          description="Pick a platform and an objective. Nexa writes up to five variations, each with its own angle and creative idea."
          action={
            <LinkButton href="/ads/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Write your first ads
            </LinkButton>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...sets.values()].map((set) => {
            const first = set[set.length - 1]
            const ready = set.filter((ad) => ad.status === 'READY').length
            return (
              <li key={first.id}>
                <Link
                  href={`/ads/${first.id}`}
                  className="block h-full rounded-xl border border-ink-200 bg-raised p-4 shadow-xs transition-colors hover:border-ink-300 hover:bg-ink-50"
                >
                  <p className="text-[12px] font-medium text-ink-500">
                    {AD_SPECS[first.platform as AdPlatform].label} · {AD_SPECS[first.platform as AdPlatform].format}
                  </p>
                  <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold text-ink-900">
                    {first.headlines[0] ?? first.primaryText}
                  </h3>
                  <p className="mt-3 text-[12.5px] text-ink-500">
                    {set.length} ad{set.length === 1 ? '' : 's'}
                    {ready > 0 && ` · ${ready} ready`}
                    {first.campaign && ` · ${first.campaign.name}`}
                    {' · '}
                    {first.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </PageBody>
  )
}
