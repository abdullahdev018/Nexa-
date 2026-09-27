'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { FORMAT_LABEL, PLATFORMS, PLATFORM_LABEL, type ContentFormat, type Platform } from '@/lib/campaigns/options'
import { PLATFORM_FORMATS } from '@/lib/studio/options'
import { localDayKey } from '@/lib/calendar/plan'
import { toInstant } from './AddToCalendar'

export interface CalendarItemView {
  id: string
  scheduledFor: string
  title: string
  notes: string | null
  platform: Platform
  format: ContentFormat
  status: 'DRAFT' | 'READY' | 'SCHEDULED' | 'PUBLISHED'
  contentId: string | null
  campaign: { id: string; name: string } | null
}

function timeOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Adds an item on a day (`item` unset) or edits one. An item that is a
 * content piece takes its platform and format from the piece.
 */
export function ItemDialog({
  open,
  onClose,
  item,
  day,
  canCreate,
}: {
  open: boolean
  onClose: () => void
  item: CalendarItemView | null
  /** The day clicked, for a new item. */
  day: string | null
  canCreate: boolean
}) {
  const router = useRouter()
  const form = useApiForm()
  const start = item ? new Date(item.scheduledFor) : null
  const [date, setDate] = useState(start ? localDayKey(start) : day ?? '')
  const [time, setTime] = useState(start ? timeOf(start) : '10:00')
  const [title, setTitle] = useState(item?.title ?? '')
  const [platform, setPlatform] = useState<Platform>(item?.platform ?? 'INSTAGRAM')
  const [format, setFormat] = useState<ContentFormat>(item?.format ?? 'POST')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [status, setStatus] = useState<'DRAFT' | 'READY'>(item?.status === 'READY' ? 'READY' : 'DRAFT')

  const fromContent = Boolean(item?.contentId)
  const formats = PLATFORM_FORMATS[platform].includes(format) ? PLATFORM_FORMATS[platform] : [format, ...PLATFORM_FORMATS[platform]]

  async function save() {
    const scheduledFor = toInstant(date, time)
    const result = item
      ? await form.submit(
          `/api/calendar/${item.id}`,
          { scheduledFor, title, notes, status, ...(fromContent ? {} : { platform, format }) },
          'PATCH',
        )
      : await form.submit('/api/calendar', { scheduledFor, title, notes, platform, format })
    form.stop()
    if (!result) return
    onClose()
    router.refresh()
  }

  async function remove() {
    if (!item) return
    const result = await form.submit(`/api/calendar/${item.id}`, {}, 'DELETE')
    form.stop()
    if (!result) return
    onClose()
    router.refresh()
  }

  const readOnly = !item && !canCreate

  return (
    <Modal open={open} title={item ? 'Edit item' : 'Plan a post'} onClose={onClose} busy={form.submitting}>
      {form.error && <Alert className="mb-4">{form.error}</Alert>}
      <div className="space-y-4">
        <Field label="Title" error={form.fields.title}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Behind the scenes: pouring the fig batch" aria-describedby={describedBy} invalid={invalid} disabled={readOnly} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={form.fields.scheduledFor}>
            {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />}
          </Field>
          <Field label="Time">
            {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={readOnly} />}
          </Field>
          <Field label="Platform" hint={fromContent ? 'Set by the content piece.' : undefined}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={platform}
                disabled={fromContent || readOnly}
                onChange={(e) => {
                  const next = e.target.value as Platform
                  setPlatform(next)
                  if (!PLATFORM_FORMATS[next].includes(format)) setFormat(PLATFORM_FORMATS[next][0])
                }}
              >
                {PLATFORMS.map((option) => (
                  <option key={option} value={option}>
                    {PLATFORM_LABEL[option]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Format">
            {({ id }) => (
              <Select id={id} value={format} disabled={fromContent || readOnly} onChange={(e) => setFormat(e.target.value as ContentFormat)}>
                {formats.map((option) => (
                  <option key={option} value={option}>
                    {FORMAT_LABEL[option]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Notes" error={form.fields.notes}>
          {({ id }) => <Textarea id={id} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hook, what to show, who is posting it." disabled={readOnly} />}
        </Field>
        {item && !fromContent && (
          <Field label="Status" hint="Ready means the post is written and good to go.">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'READY')}>
                <option value="DRAFT">Idea — not written yet</option>
                <option value="READY">Ready to post</option>
              </Select>
            )}
          </Field>
        )}
        {item?.contentId && (
          <p className="text-[13px] text-ink-600">
            This is a content piece.{' '}
            <Link href={`/content/${item.contentId}`} className="font-medium text-brand-600 hover:underline">
              Open the copy
            </Link>
          </p>
        )}
        {item?.campaign && (
          <p className="text-[13px] text-ink-600">
            From{' '}
            <Link href={`/campaigns/${item.campaign.id}`} className="font-medium text-brand-600 hover:underline">
              {item.campaign.name}
            </Link>
          </p>
        )}
        {readOnly && <p className="text-[13px] text-ink-600">Adding to the calendar is included from Starter.</p>}
      </div>

      <div className="mt-6 flex items-center gap-2">
        {item && (
          <Button variant="ghost" className="text-danger-icon hover:text-danger-text" onClick={remove} disabled={form.submitting}>
            {item.contentId ? 'Remove from calendar' : 'Delete'}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={form.submitting || readOnly || !title.trim() || !toInstant(date, time)}>
            {form.submitting ? <Spinner label="Saving" /> : item ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
