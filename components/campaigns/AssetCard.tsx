'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Check, Copy, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { FORMAT_LABEL, PLATFORM_LABEL } from '@/lib/campaigns/options'
import { KIND_LABEL, type AssetKind, type AssetMeta } from '@/lib/campaigns/plan'

export interface CampaignAssetView {
  id: string
  kind: AssetKind
  title: string | null
  body: string
  meta: AssetMeta | null
}

/** Platform, format and day, as small labels above the piece. */
export function MetaChips({ meta }: { meta: AssetMeta | null }) {
  if (!meta) return null
  const chips = [
    meta.day ? `Day ${meta.day}` : null,
    meta.platform ? PLATFORM_LABEL[meta.platform] : null,
    meta.format ? FORMAT_LABEL[meta.format] : null,
  ].filter(Boolean)
  if (chips.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11.5px] font-medium text-ink-600">
          {chip}
        </span>
      ))}
    </div>
  )
}

/** The text a "Copy" puts on the clipboard: everything someone would paste. */
function clipboardText(asset: CampaignAssetView): string {
  const parts = [asset.title, asset.meta?.hook ? `Hook: ${asset.meta.hook}` : null, asset.body]
  if (asset.meta?.description) parts.push(asset.meta.description)
  if (asset.meta?.hashtags?.length) parts.push(asset.meta.hashtags.join(' '))
  return parts.filter(Boolean).join('\n\n')
}

/**
 * One piece of a campaign. Edit is free; Regenerate asks the model for a
 * replacement and costs credits, so its button says how many.
 */
export function AssetCard({
  asset,
  regenerable,
  cost,
  compact,
  action,
  children,
}: {
  asset: CampaignAssetView
  /** Repeatable pieces can be regenerated and removed; core sections only edited. */
  regenerable: boolean
  cost: number
  compact?: boolean
  /** An extra toolbar action, e.g. "Create content" from an idea. */
  action?: ReactNode
  /** Extra rendering under the body, e.g. hashtags. */
  children?: ReactNode
}) {
  const router = useRouter()
  const form = useApiForm()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(asset.title ?? '')
  const [body, setBody] = useState(asset.body)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const label = KIND_LABEL[asset.kind].toLowerCase()

  async function save() {
    const result = await form.submit(`/api/campaign-assets/${asset.id}`, { title, body }, 'PATCH')
    if (!result) return
    form.stop()
    setEditing(false)
    router.refresh()
  }

  async function regenerate() {
    const result = await form.submit(`/api/campaign-assets/${asset.id}/regenerate`, {})
    form.stop()
    if (!result) return
    router.refresh()
  }

  async function remove() {
    const result = await form.submit(`/api/campaign-assets/${asset.id}`, {}, 'DELETE')
    form.stop()
    setConfirmDelete(false)
    if (result) router.refresh()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(clipboardText(asset))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); nothing to recover.
    }
  }

  // A piece that was regenerated arrives with new props; edits start from it.
  function startEditing() {
    setTitle(asset.title ?? '')
    setBody(asset.body)
    setEditing(true)
  }

  const busy = form.submitting

  return (
    <article
      className={cn(
        'group relative rounded-xl border border-ink-200 bg-raised shadow-xs',
        compact ? 'p-3.5' : 'p-4',
        form.submitting && !editing && 'opacity-60',
      )}
      aria-busy={form.submitting || undefined}
    >
      {editing ? (
        <div className="space-y-3">
          {asset.title !== null && (
            <Input
              aria-label="Title"
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
          <Textarea
            aria-label={`Edit ${label}`}
            rows={Math.min(14, Math.max(3, Math.ceil(body.length / 80)))}
            value={body}
            maxLength={6000}
            onChange={(event) => setBody(event.target.value)}
            invalid={Boolean(form.fields.body)}
          />
          {(form.error || form.fields.body) && (
            <p className="text-[13px] text-danger-icon">{form.fields.body ?? form.error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={form.submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={form.submitting || !body.trim()}>
              {form.submitting ? <Spinner label="Saving" /> : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <MetaChips meta={asset.meta} />
          {asset.title && (
            <h4 className={cn('font-semibold text-ink-900', compact ? 'text-[14px]' : 'text-[14.5px]')}>
              {asset.title}
            </h4>
          )}
          {asset.meta?.hook && (
            <p className="mt-1 text-[13.5px] italic text-ink-700">&ldquo;{asset.meta.hook}&rdquo;</p>
          )}
          {asset.body && (
            <p
              className={cn(
                'whitespace-pre-wrap leading-relaxed text-ink-700',
                compact ? 'text-[13px]' : 'text-[14px]',
                asset.title && 'mt-1.5',
              )}
            >
              {asset.body}
            </p>
          )}
          {children}

          {form.error && <p className="mt-2 text-[13px] text-danger-icon">{form.error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-ink-100 pt-2.5">
            <Button size="sm" variant="ghost" onClick={copy} className="h-8 px-2">
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="ghost" onClick={startEditing} disabled={busy} className="h-8 px-2">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
            {action}
            {regenerable && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={regenerate}
                  disabled={busy}
                  className="h-8 px-2"
                  title={`Write a new ${label}. Costs ${cost} credits, only if it succeeds.`}
                >
                  {form.submitting ? <Spinner className="h-3.5 w-3.5" label="Regenerating" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                  Regenerate
                  <span className="text-ink-400">· {cost}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="ml-auto h-8 px-2"
                  aria-label={`Remove this ${label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove this ${label}?`}
        body="It is removed from the campaign. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
        busy={form.submitting}
      />
    </article>
  )
}
