import { z } from 'zod'
import { GOALS, GOAL_OPTIONS, type CampaignGoal, type Platform } from '@/lib/campaigns/options'
import { extractJson, type ParseResult } from '@/lib/campaigns/plan'

/**
 * Ad copy: platforms, their limits, and how ads are asked for and checked.
 * Pure.
 *
 * Nexa writes ads. It does not launch them or spend money — that needs a
 * connected ad account and an explicit confirmation, and there is neither.
 */

export const AD_PLATFORMS = ['META', 'GOOGLE', 'TIKTOK'] as const
export type AdPlatform = (typeof AD_PLATFORMS)[number]

export interface AdSpec {
  label: string
  /** What this ad format is, in one line. */
  format: string
  primaryText: { max: number; recommended?: number } | null
  headlines: { min: number; max: number; chars: number; hard: boolean } | null
  descriptions: { min: number; max: number; chars: number; hard: boolean } | null
  ctas: readonly string[]
}

/**
 * Character limits as each platform documents them. `hard` means the platform
 * rejects anything longer, so over-limit lines are dropped; otherwise it only
 * truncates, so they are kept and flagged.
 */
export const AD_SPECS: Record<AdPlatform, AdSpec> = {
  META: {
    label: 'Meta',
    format: 'Facebook and Instagram feed ad',
    primaryText: { max: 2200, recommended: 125 },
    headlines: { min: 1, max: 5, chars: 40, hard: false },
    descriptions: { min: 0, max: 5, chars: 30, hard: false },
    ctas: ['Shop now', 'Learn more', 'Sign up', 'Book now', 'Get offer', 'Order now', 'Contact us', 'Subscribe', 'Download'],
  },
  GOOGLE: {
    label: 'Google',
    format: 'Responsive search ad',
    primaryText: null,
    headlines: { min: 3, max: 15, chars: 30, hard: true },
    descriptions: { min: 2, max: 4, chars: 90, hard: true },
    ctas: [],
  },
  TIKTOK: {
    label: 'TikTok',
    format: 'In-feed video ad',
    primaryText: { max: 100 },
    headlines: null,
    descriptions: null,
    ctas: ['Shop now', 'Learn more', 'Sign up', 'Book now', 'Order now', 'Download', 'Contact us', 'Apply now'],
  },
}

export const MAX_AD_VARIATIONS = 5

/** Where a campaign's ad copy lands in Ad Studio. */
export function adPlatformFor(platform: Platform | null | undefined): AdPlatform {
  if (platform === 'GOOGLE') return 'GOOGLE'
  if (platform === 'TIKTOK') return 'TIKTOK'
  return 'META'
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((value) => value.trim() || null)
    .nullable()
    .optional()

export const adRequestSchema = z.object({
  platform: z.enum(AD_PLATFORMS, 'Choose a platform.'),
  objective: z.enum(GOALS, 'Choose an objective.'),
  variations: z.coerce.number().int().min(1).max(MAX_AD_VARIATIONS).default(3),
  productId: z.string().min(1).max(40).nullable().optional(),
  campaignId: z.string().min(1).max(40).nullable().optional(),
  offer: optionalText(300, 'The offer'),
  audience: optionalText(300, 'The audience'),
  notes: optionalText(1000, 'Notes'),
})

export type AdRequest = z.infer<typeof adRequestSchema>

// ---------------------------------------------------------------------------
// A variation
// ---------------------------------------------------------------------------

export interface AdVariation {
  primaryText: string
  headlines: string[]
  descriptions: string[]
  cta: string | null
  audienceAngle: string | null
  creativeConcept: string | null
}

const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

function lines(value: unknown, limit: AdSpec['headlines']): string[] {
  if (!limit || !Array.isArray(value)) return []
  const unique = [...new Set(value.map(clean).filter(Boolean))]
  const usable = limit.hard ? unique.filter((line) => line.length <= limit.chars) : unique
  return usable.slice(0, limit.max)
}

/** A CTA must be one of the platform's own buttons, whatever the model wrote. */
export function matchCta(platform: AdPlatform, value: unknown): string | null {
  const wanted = clean(value).toLowerCase()
  if (!wanted) return null
  return AD_SPECS[platform].ctas.find((cta) => cta.toLowerCase() === wanted) ?? null
}

/**
 * Turns one model-written ad into something the platform would accept, or
 * null when it cannot be: too few usable headlines for Google, no text for
 * TikTok. Hard limits drop lines; soft limits keep them to be flagged.
 */
export function toVariation(platform: AdPlatform, raw: unknown): AdVariation | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const spec = AD_SPECS[platform]

  const primaryText = spec.primaryText ? clean(input.primaryText).slice(0, spec.primaryText.max) : ''
  const headlines = lines(input.headlines, spec.headlines)
  const descriptions = lines(input.descriptions, spec.descriptions)

  if (spec.primaryText && !primaryText) return null
  if (spec.headlines && headlines.length < spec.headlines.min) return null
  if (spec.descriptions && descriptions.length < spec.descriptions.min) return null

  return {
    primaryText,
    headlines,
    descriptions,
    cta: matchCta(platform, input.cta),
    audienceAngle: clean(input.audienceAngle).slice(0, 600) || null,
    creativeConcept: clean(input.creativeConcept).slice(0, 800) || null,
  }
}

export function parseAds(reply: string, platform: AdPlatform, expected: number): ParseResult<AdVariation[]> {
  const json = extractJson(reply) as { ads?: unknown } | null
  if (!json || !Array.isArray(json.ads)) return { ok: false, reason: 'not_json' }
  const usable = json.ads
    .map((ad) => toVariation(platform, ad))
    .filter((ad): ad is AdVariation => ad !== null)
    .slice(0, expected)
  if (usable.length === 0) return { ok: false, reason: 'no_usable_ad' }
  return { ok: true, value: usable }
}

// ---------------------------------------------------------------------------
// Checking an ad (after edits too)
// ---------------------------------------------------------------------------

export interface AdIssue {
  field: 'primaryText' | 'headlines' | 'descriptions'
  index?: number
  severity: 'error' | 'warning'
  message: string
}

/** What is wrong with an ad for its platform. Errors would be rejected; warnings truncated. */
export function adIssues(platform: AdPlatform, ad: Pick<AdVariation, 'primaryText' | 'headlines' | 'descriptions'>): AdIssue[] {
  const spec = AD_SPECS[platform]
  const issues: AdIssue[] = []

  if (spec.primaryText) {
    const length = ad.primaryText.length
    if (length === 0) issues.push({ field: 'primaryText', severity: 'error', message: 'Primary text is empty.' })
    else if (length > spec.primaryText.max) {
      issues.push({ field: 'primaryText', severity: 'error', message: `Over ${spec.primaryText.max} characters.` })
    } else if (spec.primaryText.recommended && length > spec.primaryText.recommended) {
      issues.push({
        field: 'primaryText',
        severity: 'warning',
        message: `Over ${spec.primaryText.recommended} characters — ${spec.label} cuts it off behind "See more".`,
      })
    }
  }

  for (const [field, limit] of [
    ['headlines', spec.headlines],
    ['descriptions', spec.descriptions],
  ] as const) {
    if (!limit) continue
    const list = ad[field]
    if (list.length < limit.min) {
      issues.push({ field, severity: 'error', message: `${spec.label} needs at least ${limit.min} ${field}.` })
    }
    list.forEach((line, index) => {
      if (line.length > limit.chars) {
        issues.push({
          field,
          index,
          severity: limit.hard ? 'error' : 'warning',
          message: limit.hard
            ? `Over ${limit.chars} characters — ${spec.label} will reject it.`
            : `Over ${limit.chars} characters — ${spec.label} may cut it off.`,
        })
      }
    })
  }
  return issues
}

/** The edit schema: shape only. Limits are reported by `adIssues`, not refused, except the platform's hard ones. */
export const updateAdSchema = z
  .object({
    primaryText: z.string().max(2200).optional(),
    headlines: z.array(z.string().max(200)).max(15).optional(),
    descriptions: z.array(z.string().max(300)).max(5).optional(),
    cta: z.string().max(40).nullable().optional(),
    audienceAngle: z.string().max(600).nullable().optional(),
    creativeConcept: z.string().max(800).nullable().optional(),
    status: z.enum(['DRAFT', 'READY'], 'Only Draft or Ready can be set here.').optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Nothing to change.')

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SHAPE: Record<AdPlatform, string> = {
  META: `"primaryText": string (lead with the hook; the first 125 characters must work alone),
  "headlines": [string] (3–5, each 40 characters or fewer),
  "descriptions": [string] (1–2, each 30 characters or fewer),
  "cta": one of ${AD_SPECS.META.ctas.map((c) => `"${c}"`).join(', ')}`,
  GOOGLE: `"headlines": [string] (12–15, each 30 characters or fewer, counting spaces — mix keywords, benefits, offer and brand),
  "descriptions": [string] (4, each 90 characters or fewer)`,
  TIKTOK: `"primaryText": string (100 characters or fewer, native and casual, no hashtag spam),
  "cta": one of ${AD_SPECS.TIKTOK.ctas.map((c) => `"${c}"`).join(', ')}`,
}

export interface AdPromptContext {
  platform: AdPlatform
  objective: CampaignGoal
  variations: number
  brandBlock: string | null
  product?: string | null
  campaign?: string | null
  offer?: string | null
  audience?: string | null
  notes?: string | null
  /** Replacing one ad: what it said, and what the others say. */
  current?: string | null
  others?: string[]
}

const ROLE = `You are Nexa, a senior performance-marketing copywriter. You write ads that
follow each platform's rules and limits exactly, lead with a concrete benefit,
and ask for one action. Do not invent claims, prices, discounts, awards,
reviews or guarantees that are not given — ad platforms reject unsupported
claims, and so do we.`

export function buildAdPrompt(context: AdPromptContext) {
  const spec = AD_SPECS[context.platform]
  const system = [
    ROLE,
    context.brandBlock,
    `Reply with ONE JSON object and nothing else — no prose, no code fence. Shape:
{ "ads": [ {
  ${SHAPE[context.platform]},
  "audienceAngle": string (who this variation speaks to, and why it lands with them),
  "creativeConcept": string (what the image or video shows)
} ] }
Write exactly ${context.variations} ad${context.variations === 1 ? '' : 's'} for a ${spec.label} ${spec.format.toLowerCase()}, each a different angle.
Respect every character limit exactly. Plain text only — no Markdown, no emoji in Google ads.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const user = [
    `Objective: ${GOAL_OPTIONS[context.objective].label} — ${GOAL_OPTIONS[context.objective].description}`,
    context.product && `Product:\n${context.product}`,
    context.offer && `Offer: ${context.offer}`,
    context.audience && `Audience: ${context.audience}`,
    context.campaign && `Campaign:\n${context.campaign}`,
    context.notes && `Notes from the user: ${context.notes}`,
    context.current && `Replace this ad with a clearly different angle:\n${context.current.slice(0, 1500)}`,
    context.others?.length
      ? `Other ads in the set (do not repeat them):\n${context.others.map((other) => `- ${other.slice(0, 200)}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}

/** One ad as readable text, for copying or showing the model what to replace. */
export function adToText(platform: AdPlatform, ad: AdVariation): string {
  return [
    ad.primaryText && `Primary text: ${ad.primaryText}`,
    ad.headlines.length > 0 && `Headlines:\n${ad.headlines.map((line) => `- ${line}`).join('\n')}`,
    ad.descriptions.length > 0 && `Descriptions:\n${ad.descriptions.map((line) => `- ${line}`).join('\n')}`,
    ad.cta && `Call to action: ${ad.cta}`,
    ad.creativeConcept && `Creative: ${ad.creativeConcept}`,
    `Platform: ${AD_SPECS[platform].label} ${AD_SPECS[platform].format.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Quotes a CSV cell, doubling quotes and neutralising spreadsheet formulas. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

/**
 * A set of ads as CSV — one row per ad, headlines and descriptions in numbered
 * columns, the way ad editors import them.
 */
export function adsToCsv(platform: AdPlatform, ads: AdVariation[]): string {
  const spec = AD_SPECS[platform]
  const headlineCols = spec.headlines ? Math.max(1, ...ads.map((ad) => ad.headlines.length)) : 0
  const descriptionCols = spec.descriptions ? Math.max(1, ...ads.map((ad) => ad.descriptions.length)) : 0

  const header = [
    'Ad',
    ...(spec.primaryText ? ['Primary text'] : []),
    ...Array.from({ length: headlineCols }, (_, i) => `Headline ${i + 1}`),
    ...Array.from({ length: descriptionCols }, (_, i) => `Description ${i + 1}`),
    ...(spec.ctas.length ? ['Call to action'] : []),
  ]

  const rows = ads.map((ad, index) => [
    String(index + 1),
    ...(spec.primaryText ? [ad.primaryText] : []),
    ...Array.from({ length: headlineCols }, (_, i) => ad.headlines[i] ?? ''),
    ...Array.from({ length: descriptionCols }, (_, i) => ad.descriptions[i] ?? ''),
    ...(spec.ctas.length ? [ad.cta ?? ''] : []),
  ])

  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}
