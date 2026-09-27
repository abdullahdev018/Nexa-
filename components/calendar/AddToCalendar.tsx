'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { CALENDAR_NOTICE, localDayKey } from '@/lib/calendar/plan'

/** Local date and time inputs → an instant. The browser knows the time zone; the server does not. */
export function toInstant(date: string, time: string): string | null {
  if (!date || !time) return null
  const instant = new Date(`${date}T${time}`)
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}

/** Puts one content piece on the calendar at a chosen local date and time. */
export function AddToCalendar({ contentId, className }: { contentId: string; className?: string }) {
  const router = useRouter()
  const form = useApiForm()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')

  function show() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDate(localDayKey(tomorrow))
    form.reset()
    setOpen(true)
  }

  async function save() {
    const result = await form.submit('/api/calendar', { contentId, scheduledFor: toInstant(date, time) })
    form.stop()
    if (!result) return
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" variant="ghost" className={className ?? 'h-8 px-2'} onClick={show}>
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Add to calendar
      </Button>
      <Modal open={open} title="Add to calendar" onClose={() => setOpen(false)} busy={form.submitting}>
        {form.error && <Alert className="mb-4">{form.error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={form.fields.scheduledFor}>
            {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Time">
            {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-600">{CALENDAR_NOTICE}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={form.submitting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={form.submitting || !toInstant(date, time)}>
            {form.submitting ? <Spinner label="Adding" /> : 'Add to calendar'}
          </Button>
        </div>
      </Modal>
    </>
  )
}
