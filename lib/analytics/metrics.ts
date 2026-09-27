import { PLATFORMS, type Platform } from '@/lib/campaigns/options'

/**
 * Analytics arithmetic. Pure.
 *
 * The rule this module exists to enforce: real numbers and demo numbers are
 * never added together. Every function here takes records of one *view* —
 * `real` (IMPORTED + CONNECTED) or `demo` (DEMO) — and the page never builds a
 * view that mixes them. `viewSources` is the only place that decides which
 * sources a view contains.
 */

export type DataSource = 'DEMO' | 'IMPORTED' | 'CONNECTED'
export type AnalyticsView = 'real' | 'demo'

export function viewSources(view: AnalyticsView): DataSource[] {
  return view === 'demo' ? ['DEMO'] : ['IMPORTED', 'CONNECTED']
}

export interface MetricRecord {
  date: Date
  platform: Platform | null
  campaignId: string | null
  reach: number
  impressions: number
  clicks: number
  leads: number
  conversions: number
  spendCents: number
  currency: string
}

export interface Totals {
  records: number
  reach: number
  impressions: number
  clicks: number
  leads: number
  conversions: number
  /** Spend per currency. Currencies are never added to each other. */
  spend: Record<string, number>
  /** Rates. Null where the denominator is zero — shown as "—", never as 0%. */
  ctr: number | null
  conversionRate: number | null
  /** Cost figures exist only when every record shares one currency. */
  currency: string | null
  cpcCents: number | null
  cplCents: number | null
  cpaCents: number | null
}

const ratio = (top: number, bottom: number) => (bottom > 0 ? top / bottom : null)

export function summarise(records: MetricRecord[]): Totals {
  const sum = (key: 'reach' | 'impressions' | 'clicks' | 'leads' | 'conversions') =>
    records.reduce((total, record) => total + record[key], 0)

  const spend: Record<string, number> = {}
  for (const record of records) {
    if (record.spendCents > 0) spend[record.currency] = (spend[record.currency] ?? 0) + record.spendCents
  }
  const currencies = Object.keys(spend)
  const currency = currencies.length === 1 ? currencies[0] : null
  const spent = currency ? spend[currency] : 0

  const clicks = sum('clicks')
  const leads = sum('leads')
  const conversions = sum('conversions')
  const impressions = sum('impressions')

  return {
    records: records.length,
    reach: sum('reach'),
    impressions,
    clicks,
    leads,
    conversions,
    spend,
    ctr: ratio(clicks, impressions),
    conversionRate: ratio(conversions, clicks),
    currency,
    cpcCents: currency ? ratio(spent, clicks) : null,
    cplCents: currency ? ratio(spent, leads) : null,
    cpaCents: currency ? ratio(spent, conversions) : null,
  }
}

/** Totals per key, largest spend-or-clicks first. */
export function breakdown<K extends string>(
  records: MetricRecord[],
  keyOf: (record: MetricRecord) => K | null,
): { key: K | null; totals: Totals }[] {
  const groups = new Map<K | null, MetricRecord[]>()
  for (const record of records) {
    const key = keyOf(record)
    groups.set(key, [...(groups.get(key) ?? []), record])
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, totals: summarise(group) }))
    .sort((a, b) => b.totals.clicks - a.totals.clicks || b.totals.impressions - a.totals.impressions)
}

export const SERIES_METRICS = ['clicks', 'impressions', 'reach', 'leads', 'conversions', 'spendCents'] as const
export type SeriesMetric = (typeof SERIES_METRICS)[number]

/**
 * One point per UTC day from `from` to `to`, zeros included — a gap in the
 * line would read as missing data, and a missing day really is zero here.
 */
export function dailySeries(
  records: MetricRecord[],
  metric: SeriesMetric,
  from: Date,
  to: Date,
): { day: string; value: number }[] {
  const byDay = new Map<string, number>()
  for (const record of records) {
    const key = record.date.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + record[metric])
  }
  const out: { day: string; value: number }[] = []
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime(); t += 86_400_000) {
    const key = new Date(t).toISOString().slice(0, 10)
    out.push({ day: key, value: byDay.get(key) ?? 0 })
  }
  return out
}

export const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const
export type RangeKey = keyof typeof RANGES

/** The UTC days a range covers, ending today. Unknown input → 30 days. */
export function rangeWindow(value: unknown, now = new Date()): { key: RangeKey; from: Date; to: Date } {
  const key: RangeKey = typeof value === 'string' && value in RANGES ? (value as RangeKey) : '30d'
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (RANGES[key] - 1)))
  return { key, from, to }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: value >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`
}

export function formatMoney(cents: number | null, currency: string | null): string {
  if (cents === null || !currency) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

/** A small seeded generator, so the same workspace always sees the same demo. */
function seeded(seed: string) {
  let h = 2166136261
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/**
 * Plausible sample numbers for `days` days, to show what the page does. They
 * are stored with source DEMO and live only in the demo view.
 */
export function demoRecords(seed: string, platforms: Platform[], days: number, today = new Date()): Omit<MetricRecord, 'campaignId'>[] {
  const random = seeded(seed)
  const out: Omit<MetricRecord, 'campaignId'>[] = []
  const list = platforms.length > 0 ? platforms : (['INSTAGRAM', 'TIKTOK'] as Platform[])

  for (let d = days - 1; d >= 0; d -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d, 12))
    const trend = 1 + (days - d) / days // grows over the period
    const weekend = [0, 6].includes(date.getUTCDay()) ? 0.8 : 1
    for (const platform of list) {
      const impressions = Math.round((1500 + random() * 2500) * trend * weekend)
      const reach = Math.round(impressions * (0.6 + random() * 0.2))
      const clicks = Math.round(impressions * (0.008 + random() * 0.017))
      const leads = Math.round(clicks * (0.05 + random() * 0.1))
      const conversions = Math.round(clicks * (0.02 + random() * 0.04))
      const spendCents = Math.round(clicks * (40 + random() * 80))
      out.push({ date, platform, reach, impressions, clicks, leads, conversions, spendCents, currency: 'USD' })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = ['date', 'platform', 'reach', 'impressions', 'clicks', 'leads', 'conversions', 'spend', 'currency'] as const

export const MAX_IMPORT_ROWS = 5000

export interface ImportRow {
  date: string
  platform: Platform | null
  reach: number
  impressions: number
  clicks: number
  leads: number
  conversions: number
  spendCents: number
  currency: string
}

/** Splits CSV text into rows of cells, honouring quotes and doubled quotes. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const PLATFORM_ALIASES: Record<string, Platform> = { IG: 'INSTAGRAM', FB: 'FACEBOOK', META: 'FACEBOOK', YT: 'YOUTUBE', GOOGLEADS: 'GOOGLE' }

function toCount(raw: string | undefined): number | null {
  const cleaned = (raw ?? '').replace(/[,\s]/g, '')
  if (!cleaned) return 0
  const value = Number(cleaned)
  return Number.isFinite(value) && value >= 0 && value <= 1e12 ? Math.round(value) : null
}

/**
 * Parses an import. Headers are matched by name (any order, any case); the
 * date must be YYYY-MM-DD; numbers may use thousands separators; spend is in
 * currency units ("12.50"). Bad rows are skipped and reported in `errors`,
 * never guessed at; rows imported with something dropped are noted in
 * `warnings`.
 */
export function parseImport(text: string): { rows: ImportRow[]; errors: string[]; warnings: string[] } {
  const table = splitCsv(text.replace(/^﻿/, ''))
  if (table.length === 0) return { rows: [], errors: ['The file is empty.'], warnings: [] }

  const header = table[0].map((cell) => cell.trim().toLowerCase().replace(/[^a-z]/g, ''))
  const col = (name: string) => header.indexOf(name)
  if (col('date') === -1) {
    return { rows: [], errors: ['The first row must be a header with a "date" column.'], warnings: [] }
  }

  const rows: ImportRow[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const body = table.slice(1)
  if (body.length > MAX_IMPORT_ROWS) warnings.push(`Only the first ${MAX_IMPORT_ROWS} rows are imported.`)

  body.slice(0, MAX_IMPORT_ROWS).forEach((cells, index) => {
    const line = index + 2
    const get = (name: string) => (col(name) === -1 ? undefined : cells[col(name)]?.trim())

    const date = get('date') ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      errors.push(`Row ${line}: the date must look like 2026-09-26.`)
      return
    }

    const rawPlatform = (get('platform') ?? '').toUpperCase().replace(/[^A-Z]/g, '')
    const platform = rawPlatform
      ? PLATFORM_ALIASES[rawPlatform] ?? PLATFORMS.find((p) => rawPlatform.startsWith(p)) ?? null
      : null
    if (rawPlatform && !platform) {
      warnings.push(`Row ${line}: "${get('platform')}" is not a platform Nexa knows; it is imported without one.`)
    }

    const numbers = {
      reach: toCount(get('reach')),
      impressions: toCount(get('impressions')),
      clicks: toCount(get('clicks')),
      leads: toCount(get('leads')),
      conversions: toCount(get('conversions')),
    }
    const bad = Object.entries(numbers).find(([, value]) => value === null)
    if (bad) {
      errors.push(`Row ${line}: "${bad[0]}" must be a whole, non-negative number.`)
      return
    }

    const rawSpend = (get('spend') ?? '').replace(/[^0-9.]/g, '')
    const spend = rawSpend ? Number(rawSpend) : 0
    if (!Number.isFinite(spend) || spend < 0 || spend > 1e10) {
      errors.push(`Row ${line}: spend must be an amount like 12.50.`)
      return
    }

    const currency = (get('currency') || 'USD').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push(`Row ${line}: currency must be a three-letter code like USD.`)
      return
    }

    rows.push({
      date,
      platform,
      ...(numbers as Record<keyof typeof numbers, number>),
      spendCents: Math.round(spend * 100),
      currency,
    })
  })

  return { rows, errors, warnings }
}
