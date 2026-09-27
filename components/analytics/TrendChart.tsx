'use client'

import { useId, useState } from 'react'
import { formatCount, formatMoney } from '@/lib/analytics/metrics'

const W = 800
const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 56 }

function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value / 4) ?? 10
  return Math.ceil(value / (step * power)) * step * power
}

function dayLabel(day: string, long = false): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(long && { weekday: 'short' }),
    timeZone: 'UTC',
  })
}

/**
 * One metric over time. One series, one axis: the title names it, so there is
 * no legend box. Hover or arrow keys move a crosshair; the same numbers are
 * available as a table for screen readers and anyone who prefers one.
 */
export function TrendChart({
  series,
  label,
  currency,
}: {
  series: { day: string; value: number }[]
  label: string
  /** Set when the values are money in minor units. */
  currency?: string | null
}) {
  const format = (value: number) => (currency ? formatMoney(value, currency) : formatCount(value))
  const titleId = useId()
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...series.map((point) => point.value)))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const path = series.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.value).toFixed(1)}`).join('')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const labelEvery = Math.max(1, Math.ceil(series.length / 6))
  const point = active === null ? null : series[active]

  function fromPointer(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const svgX = ratio * W
    const i = Math.round(((svgX - PAD.left) / innerW) * (series.length - 1))
    setActive(Math.min(series.length - 1, Math.max(0, i)))
  }

  return (
    <figure aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">
        {label} per day
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${label} per day, from ${dayLabel(series[0]?.day ?? '')} to ${dayLabel(series.at(-1)?.day ?? '')}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-ink-200" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-500 text-[11px] tabular-nums">
                {format(tick)}
              </text>
            </g>
          ))}
          {series.map((p, i) =>
            i % labelEvery === 0 || i === series.length - 1 ? (
              <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[11px]">
                {dayLabel(p.day)}
              </text>
            ) : null,
          )}
          <path d={path} fill="none" className="stroke-brand-600" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {point && active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-ink-400" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(active)} cy={y(point.value)} r={5} className="fill-brand-600 stroke-raised" strokeWidth={2} />
            </g>
          )}
          {/* A hit area the size of the plot, so the crosshair follows the pointer anywhere. */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            aria-label="Move with the arrow keys to read each day"
            onPointerMove={fromPointer}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(series.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? series.length) - 1))
              if (event.key === 'ArrowRight') setActive((i) => Math.min(series.length - 1, (i ?? -1) + 1))
            }}
            className="cursor-crosshair outline-none focus-visible:stroke-brand-600"
          />
        </svg>
        {point && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-lg bg-raised px-2.5 py-1.5 text-[12.5px] shadow-md ring-1 ring-ink-200"
            style={{ left: `${(x(active) / W) * 100}%`, transform: `translateX(${active > series.length / 2 ? '-105%' : '5%'})` }}
          >
            <span className="block text-ink-500">{dayLabel(point.day, true)}</span>
            <span className="block font-semibold tabular-nums text-ink-900">
              {format(point.value)} <span className="font-normal text-ink-600">{label.toLowerCase()}</span>
            </span>
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-[12.5px] font-medium text-ink-600 hover:text-ink-900">Show as a table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg ring-1 ring-ink-200">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-ink-50 text-ink-600">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Day</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{label}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.day} className="border-t border-ink-100">
                  <td className="px-3 py-1.5 text-ink-700">{dayLabel(p.day, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-900">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
