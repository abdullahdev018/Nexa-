import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  atLocalTime,
  buildCalendarPrompt,
  createItemSchema,
  generateCalendarSchema,
  localDayKey,
  monthGrid,
  monthKey,
  monthWindow,
  parseCalendarSlots,
  parseMonth,
  slotsToItems,
  updateItemSchema,
} from './plan'

test('month keys parse, clamp and roll over', () => {
  const fallback = new Date('2026-09-26T12:00:00Z')
  assert.deepEqual(parseMonth('2026-02', fallback), { year: 2026, month: 1 })
  assert.deepEqual(parseMonth('2026-13', fallback), { year: 2026, month: 8 })
  assert.deepEqual(parseMonth(['2026-02'], fallback), { year: 2026, month: 8 })
  assert.equal(monthKey(2026, 12), '2027-01')
  assert.equal(monthKey(2026, -1), '2025-12')
})

test('the grid is six Monday-first weeks that contain the whole month', () => {
  const grid = monthGrid(2026, 8) // September 2026 starts on a Tuesday
  assert.equal(grid.length, 42)
  assert.equal(grid[0], '2026-08-31')
  assert.equal(grid[1], '2026-09-01')
  assert.ok(grid.includes('2026-09-30'))
  const feb = monthGrid(2027, 1) // Feb 2027 starts on a Monday
  assert.equal(feb[0], '2027-02-01')
})

test('the fetch window covers the month in any time zone', () => {
  const { from, to } = monthWindow(2026, 8)
  assert.ok(from < new Date('2026-09-01T00:00:00-14:00'))
  assert.ok(to > new Date('2026-09-30T23:59:59+14:00'))
})

test('local day keys round-trip through atLocalTime', () => {
  assert.equal(localDayKey(atLocalTime('2026-03-29')), '2026-03-29')
  assert.equal(atLocalTime('2026-03-29', 18, 30).getHours(), 18)
})

test('a campaign calendar lands on real dates with fallbacks', () => {
  const start = new Date('2026-10-05T09:00:00Z')
  const items = slotsToItems(
    [
      { day: 1, title: 'Launch', notes: null, platform: 'TIKTOK', format: 'SHORT' },
      { day: 3, title: 'Behind the scenes', notes: 'n', platform: null, format: null },
    ],
    start,
    'INSTAGRAM',
  )
  assert.equal(items[0].scheduledFor.toISOString(), '2026-10-05T09:00:00.000Z')
  assert.equal(items[1].scheduledFor.toISOString(), '2026-10-07T09:00:00.000Z')
  assert.equal(items[1].platform, 'INSTAGRAM')
  assert.equal(items[1].format, 'POST')

  const tiktok = slotsToItems([{ day: 1, title: 't', notes: null, platform: null, format: 'POST' }], start, 'TIKTOK')
  assert.equal(tiktok[0].format, 'SHORT', 'TikTok has no posts; its first format is used')
})

test('an item needs a title, platform and format unless it is a content piece', () => {
  const at = '2026-10-05T09:00:00Z'
  assert.equal(createItemSchema.safeParse({ scheduledFor: at }).success, false)
  assert.equal(createItemSchema.safeParse({ scheduledFor: at, contentId: 'c1' }).success, true)
  assert.equal(createItemSchema.safeParse({ scheduledFor: at, title: 'Post', platform: 'INSTAGRAM', format: 'POST' }).success, true)
  assert.equal(createItemSchema.safeParse({ scheduledFor: 'not a date', contentId: 'c1' }).success, false)
  assert.equal(updateItemSchema.safeParse({ status: 'SCHEDULED' }).success, false)
  assert.equal(updateItemSchema.safeParse({ status: 'READY' }).success, true)
})

test('AI slots are kept in range, on asked platforms, capped and ordered', () => {
  const request = { weeks: 1, postsPerWeek: 3, platforms: ['INSTAGRAM' as const, 'TIKTOK' as const] }
  const reply = JSON.stringify({
    items: [
      { day: 5, platform: 'tiktok', format: 'shorts', title: 'E' },
      { day: 1, platform: 'Instagram', format: 'Reel', title: 'A', notes: 'hook' },
      { day: 9, platform: 'INSTAGRAM', format: 'POST', title: 'out of range' },
      { day: 2, platform: 'LinkedIn', format: 'POST', title: 'unknown platform stays, filled later' },
      { day: 3, platform: 'YOUTUBE', format: 'SHORT', title: 'not asked for' },
      { day: 4, platform: 'INSTAGRAM', format: 'POST', title: 'D' },
      { day: 6, title: '' },
    ],
  })
  const parsed = parseCalendarSlots(reply, request)
  assert.ok(parsed.ok)
  assert.deepEqual(parsed.value.map((s) => s.title), ['A', 'unknown platform stays, filled later', 'D'])
  assert.equal(parsed.value[0].format, 'REEL')
  assert.equal(parsed.value[1].platform, null)
  assert.equal(parseCalendarSlots('{"items":[]}', request).ok, false)
})

test('the AI request and prompt', () => {
  const base = { start: '2026-10-05T09:00:00Z', weeks: 2, postsPerWeek: 4, platforms: ['INSTAGRAM', 'INSTAGRAM'] }
  assert.deepEqual(generateCalendarSchema.parse(base).platforms, ['INSTAGRAM'])
  assert.equal(generateCalendarSchema.safeParse({ ...base, weeks: 5 }).success, false)
  assert.equal(generateCalendarSchema.safeParse({ ...base, platforms: [] }).success, false)

  const { system, user } = buildCalendarPrompt({
    request: { weeks: 2, postsPerWeek: 4, platforms: ['INSTAGRAM', 'TIKTOK'], focus: 'Launch week' },
    brandBlock: '<brand>\nName: Lumen\n</brand>',
    campaign: null,
    startLabel: 'Monday 5 October',
  })
  assert.match(system, /Plan exactly 8 items across 2 weeks/)
  assert.match(system, /"day": number \(1–14\)/)
  assert.match(system, /one of INSTAGRAM, TIKTOK/)
  assert.match(user, /starting Monday 5 October/)
  assert.match(user, /Focus: Launch week/)
})
