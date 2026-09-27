import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@/lib/generated/prisma/client'
import { requireWorkspace } from '@/lib/auth/workspace'
import { FORMAT_LABEL, PLATFORMS, PLATFORM_LABEL, type Platform } from '@/lib/campaigns/options'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { ContentStatusBadge, type ContentStatus } from '@/components/studio/ContentStatusBadge'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Content Studio',
  robots: { index: false, follow: false },
}

const PAGE_SIZE = 60
const STATUSES: ContentStatus[] = ['DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED']

export default async function ContentPage(props: PageProps<'/content'>) {
  const { workspace } = await requireWorkspace()
  const search = await props.searchParams

  // Filters come from the URL, so they are only ever narrowed to known values.
  const platform = PLATFORMS.find((value) => value === search.platform)
  const status = STATUSES.find((value) => value === search.status)
  const campaignId = typeof search.campaign === 'string' ? search.campaign : undefined

  const where: Prisma.ContentWhereInput = {
    workspaceId: workspace.id,
    ...(platform && { platform }),
    ...(status && { status }),
    ...(campaignId && { campaignId }),
  }

  const [items, total, anyContent, campaign] = await Promise.all([
    prisma.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        body: true,
        platform: true,
        format: true,
        status: true,
        createdAt: true,
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.content.count({ where }),
    prisma.content.count({ where: { workspaceId: workspace.id } }),
    campaignId
      ? prisma.campaign.findFirst({ where: { id: campaignId, workspaceId: workspace.id }, select: { name: true } })
      : null,
  ])

  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const next = { platform, status, campaign: campaignId, ...patch }
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
    const query = params.toString()
    return query ? `/content?${query}` : '/content'
  }

  return (
    <PageBody wide>
      <PageHeader
        title="Content Studio"
        description="Posts, reels, stories, carousels and captions — written for each platform."
        actions={
          anyContent > 0 ? (
            <LinkButton href="/content/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create content
            </LinkButton>
          ) : null
        }
      />

      {anyContent === 0 ? (
        <EmptyState
          icon={FileText}
          title="No content yet"
          description="Pick a platform and a format, say what it is about, and Nexa writes it — up to three variations at a time."
          action={
            <LinkButton href="/content/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create your first piece
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <FilterChip href={filterHref({ platform: undefined })} active={!platform}>
              All platforms
            </FilterChip>
            {PLATFORMS.map((value) => (
              <FilterChip key={value} href={filterHref({ platform: value })} active={platform === value}>
                {PLATFORM_LABEL[value]}
              </FilterChip>
            ))}
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-ink-300" />
            <FilterChip href={filterHref({ status: undefined })} active={!status}>
              Any status
            </FilterChip>
            {STATUSES.map((value) => (
              <FilterChip key={value} href={filterHref({ status: value })} active={status === value}>
                {value === 'SCHEDULED' ? 'Planned' : value.charAt(0) + value.slice(1).toLowerCase()}
              </FilterChip>
            ))}
          </div>

          {campaign && (
            <p className="mb-4 text-[13.5px] text-ink-600">
              From <span className="font-medium text-ink-900">{campaign.name}</span> ·{' '}
              <Link href={filterHref({ campaign: undefined })} className="text-brand-600 hover:underline">
                Show all campaigns
              </Link>
            </p>
          )}

          {items.length === 0 ? (
            <p className="rounded-xl bg-ink-50 p-6 text-center text-[14px] text-ink-600 ring-1 ring-ink-200">
              Nothing matches these filters.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/content/${item.id}`}
                    className="flex h-full flex-col rounded-xl border border-ink-200 bg-raised p-4 shadow-xs transition-colors hover:border-ink-300 hover:bg-ink-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11.5px] font-medium text-ink-600">
                        {PLATFORM_LABEL[item.platform as Platform]} · {FORMAT_LABEL[item.format]}
                      </span>
                      <ContentStatusBadge status={item.status} className="ml-auto" />
                    </div>
                    <h3 className="mt-3 text-[14.5px] font-semibold text-ink-900">{item.title ?? 'Untitled'}</h3>
                    <p className="mt-1 line-clamp-3 flex-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-600">
                      {item.body}
                    </p>
                    <p className="mt-3 truncate text-[12px] text-ink-500">
                      {item.campaign ? `${item.campaign.name} · ` : ''}
                      {item.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {total > PAGE_SIZE && (
            <p className="mt-4 text-center text-[13px] text-ink-500">
              Showing the newest {PAGE_SIZE} of {total}. Narrow the filters to find older pieces.
            </p>
          )}
        </>
      )}
    </PageBody>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors',
        active ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
      )}
    >
      {children}
    </Link>
  )
}
