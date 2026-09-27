import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { creditCost, planAllows } from '@/lib/billing/plans'
import { LinkButton } from '@/components/ui/Button'
import { PageBody } from '@/components/app/PageHeader'
import { ContentCard } from '@/components/studio/ContentCard'

export const metadata: Metadata = {
  title: 'Content',
  robots: { index: false, follow: false },
}

const SELECT = {
  id: true,
  title: true,
  body: true,
  platform: true,
  format: true,
  status: true,
  topic: true,
  variantGroup: true,
  createdAt: true,
  campaign: { select: { id: true, name: true } },
} as const

/** A piece, shown beside the other variations generated with it. */
export default async function ContentDetailPage(props: PageProps<'/content/[id]'>) {
  const { workspace } = await requireWorkspace()
  const { id } = await props.params

  const content = await prisma.content.findFirst({ where: { id, workspaceId: workspace.id }, select: SELECT })
  if (!content) notFound()

  const group = content.variantGroup
    ? await prisma.content.findMany({
        where: { variantGroup: content.variantGroup, workspaceId: workspace.id },
        orderBy: { createdAt: 'asc' },
        select: SELECT,
      })
    : [content]

  const cost = creditCost('CONTENT')
  // Deleting the piece this URL names moves to a sibling, or back to the library.
  const sibling = group.find((piece) => piece.id !== content.id)
  const leaveTo = sibling ? `/content/${sibling.id}` : '/content'

  return (
    <PageBody wide>
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink-500">
        <Link href="/content" className="hover:text-ink-800 hover:underline">
          Content Studio
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{content.topic ?? content.title ?? 'Content'}</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-600">
            {group.length > 1 ? `${group.length} variations` : 'One variation'}
            {content.campaign && (
              <>
                {' · '}
                <Link href={`/campaigns/${content.campaign.id}`} className="font-medium text-ink-800 hover:underline">
                  {content.campaign.name}
                </Link>
              </>
            )}
            {' · '}
            Written {content.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-500">
            Copy it into the platform when you are ready. Nexa is not connected to any account, so it does not post for you.
          </p>
        </div>
        <LinkButton href="/content/new" variant="secondary" size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create more
        </LinkButton>
      </div>

      <div className={group.length > 1 ? 'grid gap-4 lg:grid-cols-2 xl:grid-cols-3' : 'max-w-2xl'}>
        {group.map((piece, index) => (
          <ContentCard
            key={piece.id}
            content={piece}
            label={group.length > 1 ? `Variation ${index + 1} of ${group.length}` : undefined}
            highlighted={group.length > 1 && piece.id === content.id}
            cost={cost}
            afterDeleteHref={piece.id === content.id ? leaveTo : undefined}
            calendarAllowed={planAllows(workspace.plan, 'contentCalendar')}
          />
        ))}
      </div>
    </PageBody>
  )
}
