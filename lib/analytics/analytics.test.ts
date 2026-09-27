import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  breakdown,
  dailySeries,
  demoRecords,
  formatMoney,
  formatPercent,
  parseImport,
  rangeWindow,
  splitCsv,
  summarise,
  viewSources,
  type MetricRecord,
} from './metrics'

const rec = (over: Partial<MetricRecord>): MetricRecord => ({
  date: new Date('2026-09-20T12:00:00Z'),
  platform: 'INSTAGRAM',
  campaignId: null,
  reach: 0,
  impressions: 0,
  clicks: 0,
  leads: 0,
  conversions: 0,
  spendCents: 0,
  currency: 'USD',
  ...over,
})

test('views never share a source', () => {
  const real = viewSources('real')
  const demo = viewSources('demo')
  assert.deepEqual(demo, ['DEMO'])
  assert.ok(!real.includes('DEMO'))
  assert.ok(real.every((source) => !demo.includes(source)))
})

test('totals and rates, with zero denominators left empty rather than 0%', () => {
  const totals = summarise([
    rec({ impressions: 1000, clicks: 20, leads: 4, conversions: 2, spendCents: 5000 }),
    rec({ impressions: 1000, clicks: 30, leads: 1, conversions: 3, spendCents: 5000 }),
  ])
  assert.equal(totals.clicks, 50)
  assert.equal(totals.ctr, 0.025)
  assert.equal(totals.conversionRate, 0.1)
  assert.equal(totals.cpcCents, 200)
  assert.equal(totals.cplCents, 2000)

  const empty = summarise([])
  assert.equal(empty.ctr, null)
  assert.equal(empty.cpcCents, null)
  assert.equal(formatPercent(empty.ctr), '—')
})

test('different currencies are never added together', () => {
  const totals = summarise([rec({ clicks: 10, spendCents: 1000, currency: 'USD' }), rec({ clicks: 10, spendCents: 900, currency: 'EUR' })])
  assert.deepEqual(totals.spend, { USD: 1000, EUR: 900 })
  assert.equal(totals.currency, null)
  assert.equal(totals.cpcCents, null, 'no cost per click across currencies')
  assert.equal(formatMoney(totals.cpcCents, totals.currency), '—')
})

test('breakdowns group and order by clicks', () => {
  const rows = breakdown(
    [rec({ platform: 'TIKTOK', clicks: 5 }), rec({ platform: 'INSTAGRAM', clicks: 9 }), rec({ platform: 'TIKTOK', clicks: 6 })],
    (r) => r.platform,
  )
  assert.deepEqual(rows.map((r) => [r.key, r.totals.clicks]), [['TIKTOK', 11], ['INSTAGRAM', 9]])
})

test('the daily series fills missing days with zeros', () => {
  const series = dailySeries(
    [rec({ date: new Date('2026-09-20T08:00:00Z'), clicks: 3 }), rec({ date: new Date('2026-09-22T20:00:00Z'), clicks: 4 })],
    'clicks',
    new Date('2026-09-20T00:00:00Z'),
    new Date('2026-09-22T23:59:59Z'),
  )
  assert.deepEqual(series, [
    { day: '2026-09-20', value: 3 },
    { day: '2026-09-21', value: 0 },
    { day: '2026-09-22', value: 4 },
  ])
})

test('ranges default to 30 days and end today', () => {
  const now = new Date('2026-09-26T15:00:00Z')
  const { key, from, to } = rangeWindow('bogus', now)
  assert.equal(key, '30d')
  assert.equal(from.toISOString(), '2026-08-28T00:00:00.000Z')
  assert.equal(to.toISOString().slice(0, 10), '2026-09-26')
  assert.equal(rangeWindow('7d', now).from.toISOString().slice(0, 10), '2026-09-20')
})

test('demo data is deterministic per seed and plausible', () => {
  const a = demoRecords('ws1', ['INSTAGRAM'], 30, new Date('2026-09-26T00:00:00Z'))
  const b = demoRecords('ws1', ['INSTAGRAM'], 30, new Date('2026-09-26T00:00:00Z'))
  assert.deepEqual(a, b)
  assert.equal(a.length, 30)
  for (const r of a) {
    assert.ok(r.reach <= r.impressions && r.clicks <= r.impressions && r.leads <= r.clicks)
  }
  assert.notDeepEqual(demoRecords('ws2', ['INSTAGRAM'], 30, new Date('2026-09-26T00:00:00Z')), a)
})

test('CSV splitting handles quotes, commas and CRLF', () => {
  assert.deepEqual(splitCsv('a,"b, c","say ""hi"""\r\n1,2,3\n\n'), [
    ['a', 'b, c', 'say "hi"'],
    ['1', '2', '3'],
  ])
})

test('imports match headers by name and report bad rows', () => {
  const csv = [
    '﻿Date,Platform,Impressions,Clicks,Spend,Currency,Leads',
    '2026-09-20,Instagram,"1,200",24,$36.50,usd,3',
    '2026-09-21,LinkedIn,500,5,5,USD,0',
    '09/22/2026,TikTok,100,1,1,USD,0',
    '2026-09-23,TikTok,100,-4,1,USD,0',
    '2026-09-24,,300,3,,EURO,0',
  ].join('\n')
  const { rows, errors, warnings } = parseImport(csv)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    date: '2026-09-20', platform: 'INSTAGRAM', reach: 0, impressions: 1200, clicks: 24, leads: 3, conversions: 0, spendCents: 3650, currency: 'USD',
  })
  assert.equal(rows[1].platform, null, 'unknown platform is kept, without one')
  assert.equal(errors.length, 3, 'rows that were skipped')
  assert.match(errors[0], /Row 4: the date must look like/)
  assert.match(errors[1], /Row 5: "clicks" must be a whole, non-negative number/)
  assert.match(errors[2], /Row 6: currency must be a three-letter code/)
  assert.deepEqual(warnings.length, 1, 'rows imported with something dropped')
  assert.match(warnings[0], /Row 3: "LinkedIn" is not a platform/)
  assert.match(parseImport('clicks\n5').errors[0], /"date" column/)
})

test('insights see aggregates only, split by half, platform and campaign', async () => {
  const { describeData, buildInsightsPrompt, parseInsights } = await import('./insights')
  const data = describeData(
    [
      rec({ date: new Date('2026-09-01T12:00:00Z'), platform: 'TIKTOK', campaignId: 'c1', impressions: 1000, clicks: 10, spendCents: 1000 }),
      rec({ date: new Date('2026-09-20T12:00:00Z'), platform: 'INSTAGRAM', campaignId: null, impressions: 1000, clicks: 30, spendCents: 1500 }),
    ],
    new Map([['c1', 'Autumn launch']]),
    new Date('2026-09-01T00:00:00Z'),
    new Date('2026-09-26T23:59:59Z'),
  )
  assert.match(data, /Overall:.*clicks 40.*CTR 2\.0%.*spend \$25\.00.*CPC \$0\.63/)
  assert.match(data, /First half of the period:.*clicks 10/)
  assert.match(data, /Second half of the period:.*clicks 30/)
  assert.match(data, /- TikTok:.*clicks 10/)
  assert.match(data, /- Autumn launch:/)
  assert.match(data, /- No campaign:/)

  const { system } = buildInsightsPrompt(data, null)
  assert.match(system, /never invent\s+benchmarks/)

  assert.ok(parseInsights('{"summary":"s","findings":[{"title":"t","detail":"d"}],"actions":["a"]}').ok)
  assert.equal(parseInsights('{"summary":"s","findings":[],"actions":["a"]}').ok, false)
})
