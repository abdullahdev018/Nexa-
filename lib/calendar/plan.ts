import { z } from 'zod'
import {
  FORMATS,
  FORMAT_LABEL,
  PLATFORMS,
  PLATFORM_LABEL,
  type ContentFormat,
  type Platform,
} from '@/lib/campaigns/options'
import { extractJson, type ParseResult } from '@/lib/campaigns/plan'
import { PLATFORM_FORMATS } from '@/lib/studio/options'

/**
 * The marketing calendar: what an item is, the month grid, and how a campaign
 * calendar or an AI plan becomes dated items. Pure.
 *
 * A calendar item is a plan, not a post. Nexa is not connected to any
 * platform, so nothing here publishes anything, and `publishedAt` is never
 * set by this module or the UI built on it.
 */

export const CALENDAR_NOTICE =
  'Nexa is not connected to any social account, so it does not post for you. The calendar is your plan — you publish each item yourself.'

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const when = z.coerce
  .date('Choose a date and time.')
  .refine((date) => !Number.isNaN(date.getTime()), 'Choose a date and time.')
  .refine((date) => date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100, 'Choose a date between 2000 and 2100.')

const notes = z
  .string()
  .max(2000, 'Notes can be at most 2,000 characters.')
  .transform((value) => value.trim() || null)
  .nullable()
  .optional()

export const createItemSchema = z
  .object({
    scheduledFor: when,
    /** When set, the item is that content piece; the rest is copied from it. */
    contentId: z.string().min(1).max(40).nullable().optional(),
    title: z.string().trim().max(160, 'Titles can be at most 160 characters.').optional(),
    platform: z.enum(PLATFORMS).optional(),
    format: z.enum(FORMATS).optional(),
    notes,
  })
  .superRefine((item, ctx) => {
    if (item.contentId) return
    if (!item.title) ctx.addIssue({ code: 'custom', path: ['title'], message: 'Give the item a title.' })
    if (!item.platform) ctx.addIssue({ code: 'custom', path: ['platform'], message: 'Choose a platform.' })
    if (!item.format) ctx.addIssue({ code: 'custom', path: ['format'], message: 'Choose a format.' })
  })

export const updateItemSchema = z
  .object({
    scheduledFor: when.optional(),
    title: z.string().trim().min(1, 'Give the item a title.').max(160).optional(),
    platform: z.enum(PLATFORMS).optional(),
    format: z.enum(FORMATS).optional(),
    notes,
    /** DRAFT: still an idea. READY: the content is done. Nothing else is settable. */
    status: z.enum(['DRAFT', 'READY'], 'Only Draft or Ready can be set here.').optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Nothing to change.')

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "2026-09" → { year: 2026, month: 8 }. Anything else → the given fallback. */
export function parseMonth(value: unknown, fallback: Date): { year: number; month: number } {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11) return { year, month }
    }
  }
  return { year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() }
}

export function monthKey(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * The UTC window to fetch for a month. Padded by two days either side, so an
 * item that falls in the month in the viewer's time zone — up to fourteen
 * hours either side of UTC — is always included. The browser then files each
 * item under its local date.
 */
export function monthWindow(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month, 1) - 2 * 86_400_000),
    to: new Date(Date.UTC(year, month + 1, 1) + 2 * 86_400_000),
  }
}

/**
 * The 42 days (six Monday-first weeks) that show a month, as local
 * `YYYY-MM-DD` keys. Six rows always, so the grid never jumps in height.
 */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Monday = 0
  return Array.from({ length: 42 }, (_, i) => localDayKey(new Date(year, month, 1 - offset + i)))
}

/** A local calendar date as `YYYY-MM-DD`. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Midday on a local date, so a day key never slips to the previous day in UTC. */
export function atLocalTime(dayKey: string, hours = 10, minutes = 0): Date {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

// ---------------------------------------------------------------------------
// Campaign calendar → items
// ---------------------------------------------------------------------------

export interface CampaignSlot {
  day: number
  title: string
  notes: string | null
  platform: Platform | null
  format: ContentFormat | null
}

export interface PlannedItem {
  scheduledFor: Date
  title: string
  notes: string | null
  platform: Platform
  format: ContentFormat
}

/**
 * Lays a campaign's day-numbered calendar onto real dates: day 1 is `start`,
 * at the same time of day. Slots without a platform take the campaign's first
 * one, and without a usable format take that platform's first — a calendar
 * item needs both, and a TikTok "post" is not a thing.
 *
 * Days are added as 24-hour steps, so across a daylight-saving change an item
 * lands an hour off its start time. For a plan that is fine; a publishing
 * integration would schedule by local time instead.
 */
export function slotsToItems(slots: CampaignSlot[], start: Date, fallbackPlatform: Platform): PlannedItem[] {
  return slots.map((slot) => {
    const platform = slot.platform ?? fallbackPlatform
    const formats = PLATFORM_FORMATS[platform]
    return {
      scheduledFor: new Date(start.getTime() + (slot.day - 1) * 86_400_000),
      title: slot.title,
      notes: slot.notes,
      platform,
      format: slot.format && formats.includes(slot.format) ? slot.format : formats[0],
    }
  })
}

// ---------------------------------------------------------------------------
// AI plan
// ---------------------------------------------------------------------------

export const generateCalendarSchema = z.object({
  start: when,
  weeks: z.coerce.number().int().min(1).max(4),
  postsPerWeek: z.coerce.number().int().min(1).max(14),
  platforms: z
    .array(z.enum(PLATFORMS))
    .min(1, 'Choose at least one platform.')
    .transform((list) => [...new Set(list)]),
  campaignId: z.string().min(1).max(40).nullable().optional(),
  /** The start date as the user reads it ("Monday 5 October"), for the prompt. */
  startLabel: z.string().trim().max(60).optional(),
  focus: z
    .string()
    .max(1000, 'Keep the focus under 1,000 characters.')
    .transform((value) => value.trim() || null)
    .nullable()
    .optional(),
})

export type GenerateCalendarRequest = z.infer<typeof generateCalendarSchema>

const slotSchema = z.object({
  day: z.coerce.number().int().min(1).max(28),
  platform: z.unknown().optional(),
  format: z.unknown().optional(),
  title: z.string().trim().min(1).max(160),
  notes: z
    .string()
    .nullish()
    .transform((value) => value?.trim().slice(0, 1000) || null)
    .catch(null),
})

function pick<T extends string>(values: readonly T[], raw: unknown): T | null {
  if (typeof raw !== 'string') return null
  const key = raw.toUpperCase().replace(/[^A-Z]/g, '')
  return values.find((value) => key === value || key.startsWith(value)) ?? null
}

/**
 * Keeps slots that fall inside the plan and on a platform that was asked for,
 * caps them at the requested frequency, and orders them by day.
 */
export function parseCalendarSlots(
  reply: string,
  request: Pick<GenerateCalendarRequest, 'weeks' | 'postsPerWeek' | 'platforms'>,
): ParseResult<CampaignSlot[]> {
  const json = extractJson(reply) as { items?: unknown } | null
  if (!json || !Array.isArray(json.items)) return { ok: false, reason: 'not_json' }

  const days = request.weeks * 7
  const slots = json.items
    .map((item) => slotSchema.safeParse(item))
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((slot) => slot.day <= days)
    .map((slot) => ({
      day: slot.day,
      title: slot.title,
      notes: slot.notes,
      platform: pick(PLATFORMS, slot.platform),
      format: pick(FORMATS, slot.format),
    }))
    .filter((slot) => slot.platform === null || request.platforms.includes(slot.platform))
    .sort((a, b) => a.day - b.day)
    .slice(0, request.weeks * request.postsPerWeek)

  if (slots.length === 0) return { ok: false, reason: 'no_usable_items' }
  return { ok: true, value: slots }
}

export function buildCalendarPrompt(options: {
  request: Pick<GenerateCalendarRequest, 'weeks' | 'postsPerWeek' | 'platforms' | 'focus'>
  brandBlock: string | null
  campaign: string | null
  startLabel: string
}) {
  const { request } = options
  const total = request.weeks * request.postsPerWeek
  const system = [
    `You are Nexa, a social media planner. You plan a posting calendar a small
team can actually keep: varied formats, a clear theme per week, no filler.
Every item is a specific post idea, not a category.`,
    options.brandBlock,
    `Reply with ONE JSON object and nothing else. Shape:
{ "items": [ { "day": number (1–${request.weeks * 7}), "platform": one of ${request.platforms.join(', ')},
  "format": one of ${FORMATS.join(', ')}, "title": string (the specific post), "notes": string (angle, hook or what to show) } ] }
Plan exactly ${total} items across ${request.weeks} week${request.weeks === 1 ? '' : 's'} — about ${request.postsPerWeek} a week, spread across the days and platforms.
Use only the platforms listed. Plain text only.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const user = [
    `Plan ${request.weeks} week${request.weeks === 1 ? '' : 's'} of posts starting ${options.startLabel} (day 1).`,
    `Platforms: ${request.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}.`,
    request.focus && `Focus: ${request.focus}`,
    options.campaign && `Campaign:\n${options.campaign}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}

export function itemLabel(platform: Platform, format: ContentFormat): string {
  return `${PLATFORM_LABEL[platform]} ${FORMAT_LABEL[format].toLowerCase()}`
}
