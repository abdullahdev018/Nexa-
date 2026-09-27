import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { creditCost, planAllows } from '@/lib/billing/plans'
import { PLATFORM_LABEL } from '@/lib/campaigns/options'
import { VIDEO_TYPE_OPTIONS, videoPlanSchema, type VideoType } from '@/lib/video/plan'
import { videoRendering } from '@/lib/video/render'
import { Alert } from '@/components/ui/Alert'
import { PageBody } from '@/components/app/PageHeader'
import { VideoPlanView } from '@/components/video/VideoPlanView'

export const metadata: Metadata = {
  title: 'Video plan',
  robots: { index: false, follow: false },
}

export default async function VideoDetailPage(props: PageProps<'/video/[id]'>) {
  const { workspace } = await requireWorkspace()
  const { id } = await props.params

  const video = await prisma.video.findFirst({
    // Scoped by workspace as well as id: another tenant's video is a 404.
    where: { id, workspaceId: workspace.id },
    select: {
      id: true,
      title: true,
      type: true,
      platform: true,
      durationSeconds: true,
      plan: true,
      updatedAt: true,
      campaign: { select: { id: true, name: true } },
      product: { select: { name: true } },
    },
  })
  if (!video) notFound()

  const plan = videoPlanSchema.safeParse(video.plan)
  const facts = [
    VIDEO_TYPE_OPTIONS[video.type as VideoType].label,
    video.platform && PLATFORM_LABEL[video.platform],
    video.durationSeconds && `${video.durationSeconds} seconds, vertical`,
    video.product?.name,
  ].filter(Boolean)

  return (
    <PageBody wide>
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink-500">
        <Link href="/video" className="hover:text-ink-800 hover:underline">
          AI Video
        </Link>
      </nav>
      <div className="pb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900 sm:text-[26px]">{video.title ?? 'Video plan'}</h1>
        <p className="mt-1.5 text-[14px] text-ink-600">
          {facts.join(' · ')}
          {video.campaign && (
            <>
              {' · '}
              <Link href={`/campaigns/${video.campaign.id}`} className="font-medium text-ink-800 hover:underline">
                {video.campaign.name}
              </Link>
            </>
          )}
        </p>
      </div>

      {plan.success ? (
        <VideoPlanView
          key={video.updatedAt.toISOString()}
          videoId={video.id}
          plan={plan.data}
          renderExplanation={videoRendering().explanation}
          canRegenerate={planAllows(workspace.plan, 'videoGeneration')}
          cost={creditCost('VIDEO_PLAN')}
        />
      ) : (
        <Alert>This video&apos;s plan could not be read. Delete it and write a new one.</Alert>
      )}
    </PageBody>
  )
}
