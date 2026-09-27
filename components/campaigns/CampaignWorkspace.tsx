'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, Clapperboard, FileText, Pencil, Radio, RefreshCw, Sparkles, Target, Trash2 } from 'lucide-react'
import { adPlatformFor } from '@/lib/ads/plan'
import { Alert } from '@/components/ui/Alert'
import { Button, LinkButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import type { CampaignStatus } from '@/lib/campaigns/options'
import type { AssetKind } from '@/lib/campaigns/plan'
import { AssetCard, type CampaignAssetView } from './AssetCard'
import { ImportCampaignButton } from '@/components/calendar/PlanDialogs'

export interface CampaignView {
  id: string
  name: string
  status: CampaignStatus
  /** A GENERATING status the server has given up on. */
  stale: boolean
  generatedAt: string | null
  /** When the current generation started, if one is running. */
  generatingSince: string | null
  lastError: string | null
}

const WRITING = [
  'Strategy and positioning',
  'The main angle and hooks',
  'Content ideas for each platform',
  'Video concepts',
  'Ad copy and captions',
  'Calls to action',
  'A 14-day content calendar',
]

const SECTIONS: { id: string; title: string; kinds: AssetKind[]; description?: string }[] = [
  { id: 'overview', title: 'Strategy', kinds: ['STRATEGY', 'AUDIENCE_SUMMARY', 'POSITIONING', 'MARKETING_ANGLE'] },
  { id: 'hooks', title: 'Hooks', kinds: ['HOOK', 'ALT_HOOK'], description: 'The opening lines. The first one is the strongest.' },
  { id: 'ideas', title: 'Content ideas', kinds: ['CONTENT_IDEA'] },
  { id: 'video', title: 'Video concepts', kinds: ['VIDEO_CONCEPT'], description: 'Concepts and hooks. Turn one into a full shot plan with AI Video. Nothing is rendered.' },
  { id: 'ads', title: 'Ad copy', kinds: ['AD_COPY'], description: 'Starting points. Build full, platform-ready ad sets from any of them in Ad Studio. Nothing is launched.' },
  { id: 'captions', title: 'Social captions', kinds: ['SOCIAL_CAPTION'] },
  { id: 'ctas', title: 'Calls to action', kinds: ['CTA'] },
  { id: 'calendar', title: 'Content calendar', kinds: ['CONTENT_CALENDAR'], description: 'A suggested order. Add it to your calendar to put it on real dates — Nexa posts nothing.' },
]

const CORE: AssetKind[] = ['STRATEGY', 'AUDIENCE_SUMMARY', 'POSITIONING', 'MARKETING_ANGLE', 'HOOK']

export function CampaignWorkspace({
  campaign,
  assets,
  campaignCost,
  itemCost,
  balance,
  autoGenerate,
  calendarAllowed,
}: {
  campaign: CampaignView
  assets: CampaignAssetView[]
  campaignCost: number
  itemCost: number
  balance: number
  /** Set when the wizard just created this campaign and asked to generate it. */
  autoGenerate: boolean
  /** The plan includes the calendar, so its slots can be added to it. */
  calendarAllowed: boolean
}) {
  const router = useRouter()
  const generation = useApiForm()
  const action = useApiForm()
  const [confirm, setConfirm] = useState<'regenerate' | 'delete' | null>(null)
  const autoStarted = useRef(false)

  const generated = Boolean(campaign.generatedAt)
  const serverGenerating = campaign.status === 'GENERATING' && !campaign.stale
  const autoPending = autoGenerate && campaign.status === 'DRAFT' && !generated && !campaign.lastError
  const generating = serverGenerating || generation.submitting || autoPending

  async function generate() {
    setConfirm(null)
    await generation.submit(`/api/campaigns/${campaign.id}/generate`, {})
    generation.stop()
    // Success or failure, the server now holds the truth: the plan, or lastError.
    router.replace(`/campaigns/${campaign.id}`)
    router.refresh()
  }

  // Started from the wizard. The ref keeps React's development double-run
  // from sending two requests; the server's claim would refuse the second
  // anyway, but it would show as an error.
  useEffect(() => {
    if (!autoPending || autoStarted.current) return
    autoStarted.current = true
    void generation.submit(`/api/campaigns/${campaign.id}/generate`, {}).then(() => {
      generation.stop()
      router.replace(`/campaigns/${campaign.id}`)
      router.refresh()
    })
  }, [autoPending, campaign.id, generation, router])

  // Generating in another tab, or before a reload: watch until it lands.
  useEffect(() => {
    if (!serverGenerating || generation.submitting) return
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [serverGenerating, generation.submitting, router])

  async function setStatus(status: 'READY' | 'ACTIVE' | 'ARCHIVED') {
    const result = await action.submit(`/api/campaigns/${campaign.id}`, { status }, 'PATCH')
    action.stop()
    if (result) router.refresh()
  }

  async function remove() {
    const result = await action.submit(`/api/campaigns/${campaign.id}`, {}, 'DELETE')
    if (!result) {
      setConfirm(null)
      return
    }
    router.push('/campaigns')
    router.refresh()
  }

  const canAfford = balance >= campaignCost
  const error = generation.error ?? action.error ?? campaign.lastError

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {generated && !generating && (
          <>
            {campaign.status === 'ACTIVE' ? (
              <Button size="sm" variant="secondary" onClick={() => setStatus('READY')} disabled={action.submitting}>
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                Mark as not live
              </Button>
            ) : campaign.status !== 'ARCHIVED' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setStatus('ACTIVE')}
                disabled={action.submitting}
                title="Records that you are running this campaign. Nexa does not publish anything."
              >
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                Mark as live
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirm('regenerate')}
              disabled={action.submitting || !canAfford}
              title={canAfford ? undefined : `Needs ${campaignCost} credits`}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Regenerate all
            </Button>
          </>
        )}
        {!generating && (
          <>
            <LinkButton size="sm" variant="secondary" href={`/campaigns/${campaign.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit brief
            </LinkButton>
            {campaign.status === 'ARCHIVED' ? (
              <Button size="sm" variant="ghost" onClick={() => setStatus('READY')} disabled={action.submitting}>
                <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                Restore
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setStatus('ARCHIVED')} disabled={action.submitting}>
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Archive
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-danger-icon hover:text-danger-text"
              onClick={() => setConfirm('delete')}
              disabled={action.submitting}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </Button>
          </>
        )}
      </div>

      {campaign.status === 'ACTIVE' && !generating && (
        <p className="mb-6 rounded-lg bg-ink-50 p-3 text-[13px] text-ink-600 ring-1 ring-ink-200">
          You have marked this campaign as live. Nexa is not connected to any platform, so it has not
          posted or launched anything — this is your own record.
        </p>
      )}

      {error && !generating && <Alert className="mb-6">{error}</Alert>}

      {generating ? (
        <GeneratingPanel since={campaign.generatingSince} />
      ) : !generated ? (
        <div className="rounded-2xl border border-ink-200 bg-raised p-6 shadow-xs sm:p-8">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">Ready to generate</h2>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-600">
            Nexa will write the whole campaign from this brief: {WRITING.join(', ').toLowerCase()}.
            It costs {campaignCost} credits, charged only if it succeeds. You have {balance.toLocaleString()}.
          </p>
          <Button className="mt-5" size="lg" onClick={generate} disabled={!canAfford}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {campaign.lastError ? 'Try again' : 'Generate campaign'}
          </Button>
          {!canAfford && (
            <p className="mt-3 text-[13px] text-danger-text">
              Not enough credits. Credits renew at the start of the next period.
            </p>
          )}
        </div>
      ) : (
        <CampaignSections campaignId={campaign.id} assets={assets} itemCost={itemCost} calendarAllowed={calendarAllowed} />
      )}

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title="Regenerate the whole campaign?"
        body={`Nexa writes a new plan from the brief and replaces every piece, including anything you edited. It costs ${campaignCost} credits, charged only if it succeeds.`}
        confirmLabel="Regenerate"
        onConfirm={generate}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete ${campaign.name}?`}
        body="The campaign and every piece in it are deleted. Content already made from it is kept."
        confirmLabel="Delete campaign"
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
        busy={action.submitting}
      />
    </div>
  )
}

function CampaignSections({
  campaignId,
  assets,
  itemCost,
  calendarAllowed,
}: {
  campaignId: string
  assets: CampaignAssetView[]
  itemCost: number
  calendarAllowed: boolean
}) {
  const present = SECTIONS.filter((section) => assets.some((asset) => section.kinds.includes(asset.kind)))

  return (
    <div>
      <nav aria-label="Campaign sections" className="sticky top-0 z-10 -mx-1 mb-6 flex gap-1 overflow-x-auto bg-surface/90 px-1 py-2 backdrop-blur">
        {present.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {present.map((section) => {
          const items = assets.filter((asset) => section.kinds.includes(asset.kind))
          return (
            <Section
              key={section.id}
              id={section.id}
              title={section.title}
              description={section.description}
              action={
                section.id === 'calendar' && calendarAllowed ? (
                  <ImportCampaignButton campaignId={campaignId} label="Add to calendar" variant="secondary" />
                ) : undefined
              }
            >
              <div
                className={
                  section.id === 'overview'
                    ? 'grid gap-3 md:grid-cols-3 [&>*:first-child]:md:col-span-3'
                    : section.id === 'ctas' || section.id === 'calendar'
                      ? 'grid gap-2 sm:grid-cols-2'
                      : 'grid gap-3 md:grid-cols-2'
                }
              >
                {items.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    regenerable={!CORE.includes(asset.kind)}
                    cost={itemCost}
                    compact={section.id === 'ctas' || section.id === 'calendar'}
                    action={
                      asset.kind === 'AD_COPY' ? (
                        <LinkButton
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-brand-700"
                          href={`/ads/new?campaign=${campaignId}&platform=${adPlatformFor(asset.meta?.platform)}`}
                        >
                          <Target className="h-3.5 w-3.5" aria-hidden="true" />
                          Build ads
                        </LinkButton>
                      ) : asset.kind === 'VIDEO_CONCEPT' ? (
                        <LinkButton
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-brand-700"
                          href={`/video/new?campaign=${campaignId}&concept=${asset.id}`}
                        >
                          <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" />
                          Plan this video
                        </LinkButton>
                      ) : asset.kind === 'CONTENT_IDEA' ? (
                        <LinkButton
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-brand-700"
                          href={`/content/new?campaign=${campaignId}&idea=${asset.id}`}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Create content
                        </LinkButton>
                      ) : undefined
                    }
                  >
                    {asset.meta?.description && (
                      <p className="mt-2 text-[13px] text-ink-500">{asset.meta.description}</p>
                    )}
                    {asset.meta?.hashtags && asset.meta.hashtags.length > 0 && (
                      <p className="mt-2 text-[13px] text-brand-700">{asset.meta.hashtags.join(' ')}</p>
                    )}
                  </AssetCard>
                ))}
              </div>
            </Section>
          )
        })}
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-[16px] font-semibold text-ink-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13.5px] text-ink-600">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * Shown while a generation runs. It lists what is being written but does not
 * tick items off: the model returns the plan in one piece, so a step-by-step
 * progress bar would be invented.
 */
function GeneratingPanel({ since }: { since: string | null }) {
  const [start] = useState(() => (since ? new Date(since).getTime() : Date.now()))
  const [now, setNow] = useState(start)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.round((now - start) / 1000))

  return (
    <div className="rounded-2xl border border-brand-200 bg-raised p-6 shadow-xs sm:p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-brand-600" />
        <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">Nexa is writing your campaign</h2>
      </div>
      <p className="mt-2 text-[14px] text-ink-600">
        This usually takes one to two minutes. You can leave this page — it keeps going, and the campaign
        will be here when you come back.
      </p>
      <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
        {WRITING.map((line) => (
          <li key={line} className="flex items-center gap-2 text-[13.5px] text-ink-700">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[12.5px] tabular-nums text-ink-500">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} elapsed
      </p>
    </div>
  )
}
