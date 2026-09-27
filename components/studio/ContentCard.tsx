'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CalendarDays, Check, CheckCircle2, Copy, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { AddToCalendar } from '@/components/calendar/AddToCalendar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { FORMAT_LABEL, PLATFORM_LABEL, type ContentFormat, type Platform } from '@/lib/campaigns/options'
import { ContentStatusBadge, type ContentStatus } from './ContentStatusBadge'

export interface ContentView {
  id: string
  title: string | null
  body: string
  platform: Platform
  format: ContentFormat
  status: ContentStatus
}

/**
 * One piece of content, with everything that can be done to it. Only Draft
 * and Ready are offered as statuses: Scheduled comes from adding it to the
 * calendar, and Published from a real publish — never a button.
 */
export function ContentCard({
  content,
  label,
  highlighted,
  cost,
  afterDeleteHref,
  calendarAllowed,
}: {
  content: ContentView
  /** e.g. "Variation 2 of 3". */
  label?: string
  highlighted?: boolean
  cost: number
  /** Where to go once this piece is deleted; stays on the page when unset. */
  afterDeleteHref?: string
  /** The plan includes the calendar, so "Add to calendar" is offered. */
  calendarAllowed?: boolean
}) {
  const router = useRouter()
  const form = useApiForm()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(content.title ?? '')
  const [body, setBody] = useState(content.body)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState<'delete' | 'regenerate' | null>(null)

  const locked = content.status === 'PUBLISHED'
  const planned = content.status === 'SCHEDULED'

  async function request(url: string, payload: unknown, method: string) {
    const result = await form.submit(url, payload, method)
    form.stop()
    return result
  }

  async function save() {
    if (await request(`/api/content/${content.id}`, { title, body }, 'PATCH')) {
      setEditing(false)
      router.refresh()
    }
  }

  async function setStatus(status: 'DRAFT' | 'READY') {
    if (await request(`/api/content/${content.id}`, { status }, 'PATCH')) router.refresh()
  }

  async function regenerate() {
    setConfirm(null)
    if (await request(`/api/content/${content.id}/regenerate`, {}, 'POST')) router.refresh()
  }

  async function remove() {
    const result = await request(`/api/content/${content.id}`, {}, 'DELETE')
    setConfirm(null)
    if (!result) return
    if (afterDeleteHref) router.push(afterDeleteHref)
    router.refresh()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; nothing to recover.
    }
  }

  return (
    <article
      id={content.id}
      className={cn(
        'flex flex-col rounded-2xl border bg-raised shadow-xs',
        highlighted ? 'border-brand-300 ring-1 ring-brand-200' : 'border-ink-200',
      )}
      aria-busy={form.submitting || undefined}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3">
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11.5px] font-medium text-ink-600">
          {PLATFORM_LABEL[content.platform]} · {FORMAT_LABEL[content.format]}
        </span>
        {label && <span className="text-[12px] text-ink-500">{label}</span>}
        <ContentStatusBadge status={content.status} className="ml-auto" />
      </header>

      <div className={cn('flex-1 px-4 py-4', form.submitting && !editing && 'opacity-60')}>
        {editing ? (
          <div className="space-y-3">
            <Input aria-label="Title" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
            <Textarea
              aria-label="Content"
              rows={Math.min(24, Math.max(6, body.split('\n').length + 2))}
              value={body}
              maxLength={10000}
              onChange={(event) => setBody(event.target.value)}
              invalid={Boolean(form.fields.body)}
              className="font-[inherit] text-[14px]"
            />
            {(form.fields.body || form.error) && (
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
            {content.title && <h3 className="text-[15px] font-semibold text-ink-900">{content.title}</h3>}
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-700">{content.body}</p>
            {form.error && <p className="mt-3 text-[13px] text-danger-icon">{form.error}</p>}
          </>
        )}
      </div>

      {!editing && (
        <footer className="flex flex-wrap items-center gap-1 border-t border-ink-100 px-3 py-2">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {!locked && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => {
                  setTitle(content.title ?? '')
                  setBody(content.body)
                  setEditing(true)
                }}
                disabled={form.submitting}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => setConfirm('regenerate')}
                disabled={form.submitting}
              >
                {form.submitting ? <Spinner className="h-3.5 w-3.5" label="Working" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                Rewrite
                <span className="text-ink-400">· {cost}</span>
              </Button>
              {planned ? (
                <LinkButton size="sm" variant="ghost" className="h-8 px-2" href="/calendar">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  On calendar
                </LinkButton>
              ) : content.status === 'DRAFT' ? (
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setStatus('READY')} disabled={form.submitting}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark ready
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setStatus('DRAFT')} disabled={form.submitting}>
                  Back to draft
                </Button>
              )}
              {calendarAllowed && !planned && <AddToCalendar contentId={content.id} />}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 px-2"
            onClick={() => setConfirm('delete')}
            disabled={form.submitting}
            aria-label="Delete this content"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </footer>
      )}

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title="Rewrite this variation?"
        body={`Nexa writes a new version and replaces this one, including your edits. It costs ${cost} credits, charged only if it succeeds.`}
        confirmLabel="Rewrite"
        onConfirm={regenerate}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this content?"
        body="It is removed from the library. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
        busy={form.submitting}
      />
    </article>
  )
}
