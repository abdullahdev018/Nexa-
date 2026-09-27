import type { Metadata } from 'next'
import Link from 'next/link'
import { Clapperboard, Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { planAllows } from '@/lib/billing/plans'
import { PLATFORM_LABEL } from '@/lib/campaigns/options'
import { VIDEO_TYPE_OPTIONS, type VideoType } from '@/lib/video/plan'
import { videoRendering } from '@/lib/video/render'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { PlanLock } from '@/components/app/PlanLock'

export const metadata: Metadata = {
  title: 'AI Video',
  robots: { index: false, follow: false },
}

export default async function VideoPage() {
  const { workspace } = await requireWorkspace()
  const allowed = planAllows(workspace.plan, 'videoGeneration')

  const videos = await prisma.video.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      type: true,
      platform: true,
      durationSeconds: true,
      createdAt: true,
      campaign: { select: { name: true } },
      product: { select: { name: true } },
    },
  })

  return (
    <PageBody wide>
      <PageHeader
        title="AI Video"
        description="Shootable video plans: hook, scene-by-scene script, shots, on-screen text and voiceover."
        actions={
          allowed && videos.length > 0 ? (
            <LinkButton href="/video/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New video plan
            </LinkButton>
          ) : null
        }
      />

      <p className="mb-6 text-[13px] text-ink-500">{videoRendering().explanation}</p>

      {!allowed && (
        <div className="mb-6">
          <PlanLock plan={workspace.plan} feature="videoGeneration" what="AI video planning" />
        </div>
      )}

      {videos.length === 0 ? (
        allowed ? (
          <EmptyState
            icon={Clapperboard}
            title="No video plans yet"
            description="Choose a type — product showcase, UGC, problem/solution and more — and Nexa writes a plan you can film on a phone."
            action={
              <LinkButton href="/video/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Plan your first video
              </LinkButton>
            }
          />
        ) : null
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <Link
                href={`/video/${video.id}`}
                className="block h-full rounded-xl border border-ink-200 bg-raised p-4 shadow-xs transition-colors hover:border-ink-300 hover:bg-ink-50"
              >
                <p className="text-[12px] font-medium text-ink-500">
                  {VIDEO_TYPE_OPTIONS[video.type as VideoType].label}
                  {video.platform && ` · ${PLATFORM_LABEL[video.platform]}`}
                  {video.durationSeconds && ` · ${video.durationSeconds}s`}
                </p>
                <h3 className="mt-1.5 text-[15px] font-semibold text-ink-900">{video.title ?? 'Untitled plan'}</h3>
                <p className="mt-3 truncate text-[12.5px] text-ink-500">
                  {[video.product?.name, video.campaign?.name].filter(Boolean).join(' · ') || 'Plan'}
                  {' · '}
                  {video.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  )
}
