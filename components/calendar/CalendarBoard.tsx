'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { FORMAT_LABEL, PLATFORM_LABEL } from '@/lib/campaigns/options'
import { localDayKey, monthGrid } from '@/lib/calendar/plan'
import { ItemDialog, type CalendarItemView } from './ItemDialog'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const subscribe = () => () => {}

/**
 * Which local day an item falls on depends on the viewer's time zone, which
 * the server does not know. So the grid renders its days on the server and
 * files items into them only in the browser — no mismatch between the two.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

const TONE: Record<CalendarItemView['status'], string> = {
  DRAFT: 'bg-ink-100 text-ink-700 ring-ink-200',
  READY: 'bg-success-surface text-success-text ring-success-border',
  SCHEDULED: 'bg-brand-50 text-brand-800 ring-brand-200',
  PUBLISHED: 'bg-brand-600 text-white ring-brand-600',
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function CalendarBoard({
  year,
  month,
  items,
  canCreate,
}: {
  year: number
  month: number
  items: CalendarItemView[]
  canCreate: boolean
}) {
  const isClient = useIsClient()
  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const [dialog, setDialog] = useState<{ item: CalendarItemView | null; day: string | null; key: number } | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItemView[]>()
    if (!isClient) return map
    for (const item of [...items].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))) {
      const key = localDayKey(new Date(item.scheduledFor))
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [items, isClient])

  const today = isClient ? localDayKey(new Date()) : null
  const open = (item: CalendarItemView | null, day: string | null) =>
    setDialog((previous) => ({ item, day, key: (previous?.key ?? 0) + 1 }))
  const monthDays = days.filter((day) => day.startsWith(monthPrefix))
  const agenda = monthDays.filter((day) => byDay.has(day))

  return (
    <>
      {/* Month grid — tablets and up. */}
      <div className="hidden overflow-hidden rounded-2xl border border-ink-200 bg-raised shadow-xs md:block">
        <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const inMonth = day.startsWith(monthPrefix)
            const dayItems = byDay.get(day) ?? []
            return (
              <div
                key={day}
                className={cn(
                  'group relative min-h-[7.5rem] border-ink-200 p-1.5',
                  index % 7 !== 6 && 'border-r',
                  index < 35 && 'border-b',
                  !inMonth && 'bg-ink-50/60',
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[12.5px] tabular-nums',
                      day === today ? 'bg-brand-600 font-semibold text-white' : inMonth ? 'text-ink-700' : 'text-ink-400',
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => open(null, day)}
                      aria-label={`Plan a post on ${day}`}
                      className="rounded p-0.5 text-ink-400 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-700 focus:opacity-100 group-hover:opacity-100"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <ul className="mt-1 space-y-1">
                  {dayItems.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => open(item, null)}
                        title={`${item.title} — ${PLATFORM_LABEL[item.platform]} ${FORMAT_LABEL[item.format]}`}
                        className={cn('block w-full truncate rounded-md px-1.5 py-1 text-left text-[11.5px] ring-1 ring-inset', TONE[item.status])}
                      >
                        <span className="font-medium tabular-nums">{time(item.scheduledFor)}</span> {item.title}
                      </button>
                    </li>
                  ))}
                  {dayItems.length > 4 && (
                    <li className="px-1.5 text-[11px] text-ink-500">+{dayItems.length - 4} more — see the list below</li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Agenda — every item this month. The only view on phones; the full list under the grid elsewhere. */}
      <section className="mt-6" aria-label="This month's items">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-500">All items this month</h2>
        {isClient && agenda.length === 0 ? (
          <p className="rounded-xl bg-ink-50 p-5 text-center text-[14px] text-ink-600 ring-1 ring-ink-200">
            Nothing planned this month.
          </p>
        ) : (
          <ol className="space-y-4 md:grid md:grid-cols-2 md:gap-x-6 md:space-y-0 md:gap-y-4 xl:grid-cols-3">
            {agenda.map((day) => (
              <li key={day}>
                <p className={cn('mb-1.5 text-[13px] font-semibold', day === today ? 'text-brand-700' : 'text-ink-700')}>
                  {new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <ul className="space-y-1.5">
                  {byDay.get(day)!.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => open(item, null)}
                        className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset', TONE[item.status])}
                      >
                        <span className="w-16 shrink-0 text-[12.5px] font-medium tabular-nums">{time(item.scheduledFor)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{item.title}</span>
                          <span className="block text-[12px] opacity-75">
                            {PLATFORM_LABEL[item.platform]} · {FORMAT_LABEL[item.format]}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => open(null, today && today.startsWith(monthPrefix) ? today : monthDays[0])}
            className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-600 hover:underline md:hidden"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Plan a post
          </button>
        )}
      </section>

      {dialog && (
        <ItemDialog
          // Remounted per opening, so each starts from the item it shows.
          key={dialog.key}
          open
          onClose={() => setDialog(null)}
          item={dialog.item}
          day={dialog.day}
          canCreate={canCreate}
        />
      )}
    </>
  )
}
