'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { CalendarPlus, Sparkles } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { PLATFORMS, PLATFORM_LABEL, type Platform } from '@/lib/campaigns/options'
import { localDayKey } from '@/lib/calendar/plan'
import { toInstant } from './AddToCalendar'

function nextMonday(): string {
  const date = new Date()
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7))
  return localDayKey(date)
}

function readable(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/**
 * Lays a campaign's 14-day calendar onto dates. Free. Used from the calendar
 * (pick a campaign) and from a campaign page (`campaignId` fixed).
 */
export function ImportCampaignButton({
  campaigns,
  campaignId,
  label = 'Add a campaign',
  variant = 'secondary',
}: {
  campaigns?: { id: string; name: string }[]
  campaignId?: string
  label?: string
  variant?: 'secondary' | 'ghost'
}) {
  const router = useRouter()
  const form = useApiForm()
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState(campaignId ?? campaigns?.[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [done, setDone] = useState<number | null>(null)

  function show() {
    setDate(nextMonday())
    setDone(null)
    form.reset()
    setOpen(true)
  }

  async function submit(again: boolean) {
    const result = await form.submit<{ created: number }>('/api/calendar/import', {
      campaignId: chosen,
      start: toInstant(date, time),
      again,
    })
    form.stop()
    if (!result) return
    setDone(result.created)
    router.refresh()
  }

  // The server refuses a second import with a 409 that says so; offer the override then.
  const alreadyThere = form.error?.includes('already on the calendar') ?? false

  return (
    <>
      <Button size="sm" variant={variant} onClick={show}>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      <Modal open={open} title="Add a campaign to the calendar" onClose={() => setOpen(false)} busy={form.submitting}>
        {done !== null ? (
          <>
            <Alert tone="success">
              Added {done} item{done === 1 ? '' : 's'} starting {readable(date)}. They are ideas until you write and post them.
            </Alert>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </>
        ) : (
          <>
            {form.error && <Alert className="mb-4">{form.error}</Alert>}
            {!campaignId && (
              <div className="mb-4">
                <Field label="Campaign">
                  {({ id }) => (
                    <Select id={id} value={chosen} onChange={(e) => setChosen(e.target.value)}>
                      {campaigns?.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day 1 is" error={form.fields.start}>
                {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label="Posting time">
                {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
              </Field>
            </div>
            <p className="mt-4 text-[13px] text-ink-600">Free — nothing is generated. Each slot becomes an idea on its day.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={form.submitting}>
                Cancel
              </Button>
              {alreadyThere ? (
                <Button variant="secondary" onClick={() => submit(true)} disabled={form.submitting}>
                  Add it again anyway
                </Button>
              ) : (
                <Button onClick={() => submit(false)} disabled={form.submitting || !chosen || !toInstant(date, time)}>
                  {form.submitting ? <Spinner label="Adding" /> : 'Add to calendar'}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

/** Plans weeks of posts with the model, as draft ideas on the calendar. */
export function PlanWithAiButton({
  campaigns,
  cost,
  balance,
}: {
  campaigns: { id: string; name: string }[]
  cost: number
  balance: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [weeks, setWeeks] = useState(2)
  const [perWeek, setPerWeek] = useState(4)
  const [platforms, setPlatforms] = useState<Platform[]>(['INSTAGRAM'])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [focus, setFocus] = useState('')
  const [done, setDone] = useState<number | null>(null)

  function show() {
    setDate(nextMonday())
    setDone(null)
    form.reset()
    setOpen(true)
  }

  async function submit() {
    const result = await form.submit<{ created: number }>('/api/calendar/generate', {
      start: toInstant(date, '10:00'),
      startLabel: date ? readable(date) : undefined,
      weeks,
      postsPerWeek: perWeek,
      platforms,
      campaignId,
      focus,
    })
    form.stop()
    if (!result) return
    setDone(result.created)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={show}>
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Plan with AI
      </Button>
      <Modal open={open} title="Plan with AI" onClose={() => setOpen(false)} busy={form.submitting}>
        {done !== null ? (
          <>
            <Alert tone="success">
              Planned {done} post{done === 1 ? '' : 's'} from {readable(date)}. They are ideas on your calendar — write them in the Content Studio and post them yourself.
            </Alert>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </>
        ) : (
          <>
            {form.error && <Alert className="mb-4">{form.error}</Alert>}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Starting" error={form.fields.start}>
                {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label="Weeks">
                {({ id }) => (
                  <Select id={id} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Posts a week">
                {({ id }) => (
                  <Select id={id} value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))}>
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <p className="mb-2 mt-4 text-sm font-medium text-ink-700">Platforms</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Platforms">
              {PLATFORMS.map((option) => {
                const on = platforms.includes(option)
                return (
                  <Toggle
                    key={option}
                    on={on}
                    onClick={() => setPlatforms(on ? platforms.filter((p) => p !== option) : [...platforms, option])}
                  >
                    {PLATFORM_LABEL[option]}
                  </Toggle>
                )
              })}
            </div>
            {form.fields.platforms && <p className="mt-1 text-[13px] text-danger-icon">{form.fields.platforms}</p>}
            <div className="mt-4 grid gap-3">
              {campaigns.length > 0 && (
                <Field label="Campaign" hint="Optional. The plan follows its strategy.">
                  {({ id, describedBy }) => (
                    <Select id={id} aria-describedby={describedBy} value={campaignId ?? ''} onChange={(e) => setCampaignId(e.target.value || null)}>
                      <option value="">No campaign</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <Field label="Focus" error={form.fields.focus}>
                {({ id }) => <Textarea id={id} rows={2} maxLength={1000} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Autumn gifting, the new fig scent, two founder posts." />}
              </Field>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <span className="text-[12.5px] text-ink-500">
                {cost} credits, only if it succeeds · {balance.toLocaleString()} left
              </span>
              <Button onClick={submit} disabled={form.submitting || platforms.length === 0 || balance < cost || !toInstant(date, '10:00')}>
                {form.submitting ? (
                  <>
                    <Spinner label="Planning" />
                    Planning…
                  </>
                ) : (
                  `Plan ${weeks * perWeek} posts`
                )}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors',
        on ? 'bg-ink-900 text-white ring-ink-900' : 'bg-raised text-ink-700 ring-ink-300 hover:bg-ink-50',
      )}
    >
      {children}
    </button>
  )
}
