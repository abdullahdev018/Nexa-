'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { AD_SPECS, adIssues, adToText, type AdIssue, type AdPlatform, type AdVariation } from '@/lib/ads/plan'
import { ContentStatusBadge } from '@/components/studio/ContentStatusBadge'

export interface AdView extends AdVariation {
  id: string
  platform: AdPlatform
  status: 'DRAFT' | 'READY' | 'SCHEDULED' | 'PUBLISHED'
}

function issueFor(issues: AdIssue[], field: AdIssue['field'], index?: number) {
  return issues.find((issue) => issue.field === field && issue.index === index)
}

/** A character count that turns amber past a soft limit and red past a hard one. */
function Count({ length, limit, issue }: { length: number; limit: number; issue?: AdIssue }) {
  return (
    <span
      className={cn(
        'shrink-0 text-[11.5px] tabular-nums',
        issue?.severity === 'error' ? 'text-danger-icon' : issue ? 'text-amber-600' : 'text-ink-400',
      )}
    >
      {length}/{limit}
    </span>
  )
}

export function AdCard({
  ad,
  index,
  total,
  cost,
  afterDeleteHref,
}: {
  ad: AdView
  index: number
  total: number
  cost: number
  afterDeleteHref?: string
}) {
  const router = useRouter()
  const form = useApiForm()
  const spec = AD_SPECS[ad.platform]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AdVariation>(ad)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'delete' | 'regenerate' | null>(null)

  const shown = editing ? draft : ad
  const issues = adIssues(ad.platform, shown)

  async function request(url: string, payload: unknown, method: string) {
    const result = await form.submit(url, payload, method)
    form.stop()
    return result
  }

  async function save() {
    if (await request(`/api/ads/${ad.id}`, draft, 'PATCH')) {
      setEditing(false)
      router.refresh()
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1200)
    } catch {
      // Clipboard can be blocked; nothing to recover.
    }
  }

  async function remove() {
    const result = await request(`/api/ads/${ad.id}`, {}, 'DELETE')
    setConfirm(null)
    if (!result) return
    if (afterDeleteHref) router.push(afterDeleteHref)
    router.refresh()
  }

  function setLine(field: 'headlines' | 'descriptions', i: number, value: string) {
    setDraft((current) => ({ ...current, [field]: current[field].map((line, j) => (j === i ? value : line)) }))
  }

  const lists = [
    ['headlines', 'Headlines', spec.headlines],
    ['descriptions', 'Descriptions', spec.descriptions],
  ] as const

  return (
    <article className="flex flex-col rounded-2xl border border-ink-200 bg-raised shadow-xs" aria-busy={form.submitting || undefined}>
      <header className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <span className="text-[13px] font-semibold text-ink-900">Ad {index + 1}</span>
        <span className="text-[12px] text-ink-500">of {total}</span>
        <ContentStatusBadge status={ad.status} className="ml-auto" />
      </header>

      <div className={cn('flex-1 space-y-4 px-4 py-4', form.submitting && !editing && 'opacity-60')}>
        {spec.primaryText && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Primary text</p>
              <Count
                length={shown.primaryText.length}
                limit={spec.primaryText.recommended ?? spec.primaryText.max}
                issue={issueFor(issues, 'primaryText')}
              />
            </div>
            {editing ? (
              <Textarea rows={4} value={draft.primaryText} maxLength={spec.primaryText.max} onChange={(e) => setDraft({ ...draft, primaryText: e.target.value })} />
            ) : (
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-800">{ad.primaryText}</p>
            )}
            {issueFor(issues, 'primaryText') && (
              <p className="mt-1 text-[12.5px] text-amber-700">{issueFor(issues, 'primaryText')!.message}</p>
            )}
          </div>
        )}

        {lists.map(([field, label, limit]) =>
          limit ? (
            <div key={field}>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {label} <span className="font-normal normal-case text-ink-400">· {limit.chars} characters{limit.hard ? ', enforced' : ''}</span>
              </p>
              <ul className="space-y-1.5">
                {shown[field].map((line, i) => {
                  const issue = issueFor(issues, field, i)
                  return (
                    <li key={i} className="flex items-center gap-2">
                      {editing ? (
                        <>
                          <Input value={line} maxLength={200} onChange={(e) => setLine(field, i, e.target.value)} invalid={issue?.severity === 'error'} className="py-1.5 text-[14px]" />
                          <Count length={line.length} limit={limit.chars} issue={issue} />
                          <Button size="sm" variant="ghost" className="h-8 px-1.5" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => setDraft({ ...draft, [field]: draft[field].filter((_, j) => j !== i) })}>
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => copy(`${field}-${i}`, line)}
                          title="Copy"
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md bg-ink-50 px-2.5 py-1.5 text-left text-[14px] text-ink-800 hover:bg-ink-100"
                        >
                          <span className="min-w-0 truncate">{line}</span>
                          {copied === `${field}-${i}` ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-success-icon" aria-label="Copied" />
                          ) : (
                            <Count length={line.length} limit={limit.chars} issue={issue} />
                          )}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {editing && shown[field].length < limit.max && (
                <Button size="sm" variant="ghost" className="mt-1 h-8 px-2" onClick={() => setDraft({ ...draft, [field]: [...draft[field], ''] })}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add
                </Button>
              )}
            </div>
          ) : null,
        )}

        {spec.ctas.length > 0 && (
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Button</p>
            {editing ? (
              <Select value={draft.cta ?? ''} onChange={(e) => setDraft({ ...draft, cta: e.target.value || null })} className="max-w-[12rem] py-1.5 text-[14px]">
                <option value="">None</option>
                {spec.ctas.map((cta) => (
                  <option key={cta} value={cta}>
                    {cta}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="rounded-md bg-ink-900 px-2.5 py-1 text-[12.5px] font-medium text-white">{ad.cta ?? 'None'}</span>
            )}
          </div>
        )}

        {(shown.audienceAngle || shown.creativeConcept || editing) && (
          <div className="space-y-2 border-t border-ink-100 pt-3 text-[13.5px]">
            {editing ? (
              <>
                <Textarea rows={2} aria-label="Audience angle" placeholder="Audience angle" maxLength={600} value={draft.audienceAngle ?? ''} onChange={(e) => setDraft({ ...draft, audienceAngle: e.target.value })} />
                <Textarea rows={2} aria-label="Creative concept" placeholder="Creative concept" maxLength={800} value={draft.creativeConcept ?? ''} onChange={(e) => setDraft({ ...draft, creativeConcept: e.target.value })} />
              </>
            ) : (
              <>
                {ad.audienceAngle && (
                  <p className="text-ink-700">
                    <span className="font-medium text-ink-500">Angle:</span> {ad.audienceAngle}
                  </p>
                )}
                {ad.creativeConcept && (
                  <p className="text-ink-700">
                    <span className="font-medium text-ink-500">Creative:</span> {ad.creativeConcept}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {issues.some((issue) => issue.severity === 'error') && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-danger-icon">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {spec.label} would reject this as it stands.
          </p>
        )}
        {form.error && <p className="text-[13px] text-danger-icon">{form.error}</p>}
      </div>

      <footer className="flex flex-wrap items-center gap-1 border-t border-ink-100 px-3 py-2">
        {editing ? (
          <>
            <Button size="sm" onClick={save} disabled={form.submitting}>
              {form.submitting ? <Spinner label="Saving" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(ad); setEditing(false) }} disabled={form.submitting}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => copy('all', adToText(ad.platform, ad))}>
              {copied === 'all' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              Copy
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setDraft(ad); setEditing(true) }} disabled={form.submitting}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setConfirm('regenerate')} disabled={form.submitting}>
              {form.submitting ? <Spinner className="h-3.5 w-3.5" label="Working" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              Rewrite <span className="text-ink-400">· {cost}</span>
            </Button>
            {ad.status === 'DRAFT' ? (
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={async () => { if (await request(`/api/ads/${ad.id}`, { status: 'READY' }, 'PATCH')) router.refresh() }} disabled={form.submitting}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Mark ready
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={async () => { if (await request(`/api/ads/${ad.id}`, { status: 'DRAFT' }, 'PATCH')) router.refresh() }} disabled={form.submitting}>
                Back to draft
              </Button>
            )}
            <Button size="sm" variant="ghost" className="ml-auto h-8 px-2" aria-label={`Delete ad ${index + 1}`} onClick={() => setConfirm('delete')} disabled={form.submitting}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </>
        )}
      </footer>

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title={`Rewrite ad ${index + 1}?`}
        body={`Nexa writes a new ad with a different angle and replaces this one, including your edits. It costs ${cost} credits, charged only if it succeeds.`}
        confirmLabel="Rewrite"
        onConfirm={async () => {
          setConfirm(null)
          if (await request(`/api/ads/${ad.id}/regenerate`, {}, 'POST')) router.refresh()
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete ad ${index + 1}?`}
        body="It is removed from the set. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
        busy={form.submitting}
      />
    </article>
  )
}
