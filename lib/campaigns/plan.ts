import { z } from 'zod'
import {
  FORMATS,
  GOAL_OPTIONS,
  PLATFORMS,
  PLATFORM_LABEL,
  STYLE_OPTIONS,
  type CampaignGoal,
  type CampaignStyle,
  type ContentFormat,
  type Platform,
} from './options'

/**
 * What a generated campaign looks like, how the model is asked for it, and how
 * its answer becomes editable pieces.
 *
 * Pure. The model's reply is untrusted text: it is parsed leniently (a
 * platform written "Instagram" still counts) but validated strictly (a plan
 * missing its strategy is a failed generation, not a half-empty campaign).
 */

// ---------------------------------------------------------------------------
// Lenient field parsers
// ---------------------------------------------------------------------------

const text = (max: number) =>
  z
    .string()
    .transform((value) => value.trim().slice(0, max))
    .pipe(z.string().min(1))

const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((value) => value?.trim().slice(0, max) || null)
    .catch(null)

/** "Instagram", "instagram", "IG Reels" → INSTAGRAM. Unknown → null, not a failure. */
function normalise<T extends string>(values: readonly T[], aliases: Record<string, T> = {}) {
  // `.optional()` first: in zod 4 a transformed field is otherwise required,
  // and a model leaving out "platform" must not sink the whole item.
  return z
    .unknown()
    .optional()
    .transform((value): T | null => {
      if (typeof value !== 'string') return null
      const key = value.toUpperCase().replace(/[^A-Z]/g, '')
      if (aliases[key]) return aliases[key]
      return values.find((candidate) => key === candidate || key.startsWith(candidate)) ?? null
    })
}

const platform = normalise(PLATFORMS, { IG: 'INSTAGRAM', FB: 'FACEBOOK', META: 'FACEBOOK', YT: 'YOUTUBE', GOOGLEADS: 'GOOGLE' })
const format = normalise(FORMATS, { REELS: 'REEL', STORIES: 'STORY', SHORTS: 'SHORT', VIDEO: 'REEL', IMAGE: 'POST' })

/** An array that keeps its valid entries, drops broken ones, and is capped. */
function list<T extends z.ZodType>(item: T, { min = 1, max }: { min?: number; max: number }) {
  return z
    .array(z.unknown())
    .transform((items) =>
      items
        .map((entry) => item.safeParse(entry))
        .flatMap((result) => (result.success ? [result.data as z.output<T>] : []))
        .slice(0, max),
    )
    .pipe(z.array(z.any()).min(min)) as unknown as z.ZodType<z.output<T>[]>
}

// ---------------------------------------------------------------------------
// Item schemas — one per repeatable piece, reused for single-piece regeneration
// ---------------------------------------------------------------------------

export const contentIdeaSchema = z.object({
  title: text(160),
  platform,
  format,
  description: text(1500),
})

export const videoConceptSchema = z.object({
  title: text(160),
  hook: text(300),
  concept: text(2000),
  platform,
})

export const adCopySchema = z.object({
  platform,
  headline: text(120),
  primaryText: text(1500),
  description: optionalText(300),
})

export const socialCaptionSchema = z.object({
  platform,
  caption: text(2200),
  hashtags: z
    .array(z.string())
    .catch([])
    .default([])
    .transform((tags) =>
      tags
        .map((tag) => tag.trim().replace(/^#*/, '').replace(/\s+/g, ''))
        .filter(Boolean)
        .slice(0, 15)
        .map((tag) => `#${tag}`),
    ),
})

export const calendarSlotSchema = z.object({
  day: z.coerce.number().int().min(1).max(31),
  platform,
  format,
  title: text(160),
  notes: optionalText(600),
})

const strategySchema = z.object({
  summary: text(3000),
  objective: text(600),
  keyMessage: text(600),
  phases: list(z.object({ name: text(80), focus: text(600) }), { min: 0, max: 4 }).catch([]),
})

export const campaignPlanSchema = z.object({
  strategy: strategySchema,
  audienceSummary: text(2000),
  positioning: text(1500),
  marketingAngle: text(1500),
  hook: text(300),
  alternativeHooks: list(text(300), { max: 5 }),
  contentIdeas: list(contentIdeaSchema, { max: 10 }),
  videoConcepts: list(videoConceptSchema, { max: 4 }),
  adCopy: list(adCopySchema, { max: 4 }),
  socialCaptions: list(socialCaptionSchema, { max: 6 }),
  ctas: list(text(120), { max: 6 }),
  calendar: list(calendarSlotSchema, { max: 21 }),
})

export type CampaignPlan = z.infer<typeof campaignPlanSchema>

// ---------------------------------------------------------------------------
// Parsing a reply
// ---------------------------------------------------------------------------

/**
 * Pulls the JSON object out of a reply. Models sometimes wrap it in a code
 * fence or add a sentence first despite being told not to; neither should
 * fail an otherwise good generation.
 */
export function extractJson(reply: string): unknown {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(reply.slice(start, end + 1))
  } catch {
    return null
  }
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string }

export function parseCampaignPlan(reply: string): ParseResult<CampaignPlan> {
  const json = extractJson(reply)
  if (!json) return { ok: false, reason: 'not_json' }
  const parsed = campaignPlanSchema.safeParse(json)
  if (!parsed.success) {
    // The path of the first problem is enough to debug from; the reply itself
    // is not logged.
    return { ok: false, reason: `invalid:${parsed.error.issues[0]?.path.join('.') || 'root'}` }
  }
  return { ok: true, value: parsed.data }
}

// ---------------------------------------------------------------------------
// Plan → editable assets
// ---------------------------------------------------------------------------

export type AssetKind =
  | 'STRATEGY'
  | 'AUDIENCE_SUMMARY'
  | 'POSITIONING'
  | 'MARKETING_ANGLE'
  | 'HOOK'
  | 'ALT_HOOK'
  | 'CONTENT_IDEA'
  | 'VIDEO_CONCEPT'
  | 'AD_COPY'
  | 'SOCIAL_CAPTION'
  | 'CTA'
  | 'CONTENT_CALENDAR'

export interface AssetMeta {
  platform?: Platform | null
  format?: ContentFormat | null
  day?: number
  hashtags?: string[]
  headline?: string
  description?: string | null
  hook?: string
}

export interface AssetDraft {
  kind: AssetKind
  title: string | null
  body: string
  position: number
  meta: AssetMeta | null
}

function strategyBody(strategy: CampaignPlan['strategy']): string {
  const parts = [
    strategy.summary,
    `Objective: ${strategy.objective}`,
    `Key message: ${strategy.keyMessage}`,
  ]
  if (strategy.phases.length > 0) {
    parts.push(strategy.phases.map((phase, i) => `${i + 1}. ${phase.name} — ${phase.focus}`).join('\n'))
  }
  return parts.join('\n\n')
}

/**
 * How each repeatable kind turns one parsed item into an asset. Shared by
 * whole-campaign generation and single-piece regeneration, so a regenerated
 * piece is shaped exactly like the one it replaces.
 */
export const ITEM_KINDS = {
  ALT_HOOK: {
    schema: text(300),
    toAsset: (hook: string) => ({ title: null, body: hook, meta: null }),
  },
  CONTENT_IDEA: {
    schema: contentIdeaSchema,
    toAsset: (idea: z.infer<typeof contentIdeaSchema>) => ({
      title: idea.title,
      body: idea.description,
      meta: { platform: idea.platform, format: idea.format },
    }),
  },
  VIDEO_CONCEPT: {
    schema: videoConceptSchema,
    toAsset: (video: z.infer<typeof videoConceptSchema>) => ({
      title: video.title,
      body: video.concept,
      meta: { platform: video.platform, hook: video.hook },
    }),
  },
  AD_COPY: {
    schema: adCopySchema,
    toAsset: (ad: z.infer<typeof adCopySchema>) => ({
      title: ad.headline,
      body: ad.primaryText,
      meta: { platform: ad.platform, headline: ad.headline, description: ad.description },
    }),
  },
  SOCIAL_CAPTION: {
    schema: socialCaptionSchema,
    toAsset: (caption: z.infer<typeof socialCaptionSchema>) => ({
      title: null,
      body: caption.caption,
      meta: { platform: caption.platform, hashtags: caption.hashtags },
    }),
  },
  CTA: {
    schema: text(120),
    toAsset: (cta: string) => ({ title: null, body: cta, meta: null }),
  },
  CONTENT_CALENDAR: {
    schema: calendarSlotSchema,
    toAsset: (slot: z.infer<typeof calendarSlotSchema>) => ({
      title: slot.title,
      body: slot.notes ?? '',
      meta: { day: slot.day, platform: slot.platform, format: slot.format },
    }),
  },
} as const

export type ItemKind = keyof typeof ITEM_KINDS

export function isItemKind(kind: string): kind is ItemKind {
  return kind in ITEM_KINDS
}

/** Converts one parsed item of `kind` into asset fields. */
export function itemToAsset(kind: ItemKind, item: unknown): Omit<AssetDraft, 'kind' | 'position'> {
  const spec = ITEM_KINDS[kind]
  return (spec.toAsset as (value: unknown) => Omit<AssetDraft, 'kind' | 'position'>)(item)
}

export function planToAssets(plan: CampaignPlan): AssetDraft[] {
  const assets: AssetDraft[] = [
    { kind: 'STRATEGY', title: 'Strategy', body: strategyBody(plan.strategy), position: 0, meta: null },
    { kind: 'AUDIENCE_SUMMARY', title: 'Audience', body: plan.audienceSummary, position: 0, meta: null },
    { kind: 'POSITIONING', title: 'Positioning', body: plan.positioning, position: 0, meta: null },
    { kind: 'MARKETING_ANGLE', title: 'Main angle', body: plan.marketingAngle, position: 0, meta: null },
    { kind: 'HOOK', title: 'Main hook', body: plan.hook, position: 0, meta: null },
  ]

  const repeated: [ItemKind, unknown[]][] = [
    ['ALT_HOOK', plan.alternativeHooks],
    ['CONTENT_IDEA', plan.contentIdeas],
    ['VIDEO_CONCEPT', plan.videoConcepts],
    ['AD_COPY', plan.adCopy],
    ['SOCIAL_CAPTION', plan.socialCaptions],
    ['CTA', plan.ctas],
    ['CONTENT_CALENDAR', [...plan.calendar].sort((a, b) => a.day - b.day)],
  ]

  for (const [kind, items] of repeated) {
    items.forEach((item, position) => {
      assets.push({ kind, position, ...itemToAsset(kind, item) })
    })
  }

  return assets
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export interface BriefForPrompt {
  productName: string
  productDescription?: string | null
  productCategory?: string | null
  productPrice?: string | null
  goal: CampaignGoal
  style: CampaignStyle
  platforms: Platform[]
  audienceAgeRange?: string | null
  audienceLocation?: string | null
  audienceInterests?: string[]
  audienceCustomerType?: string | null
  audiencePainPoints?: string | null
}

export function describeBrief(brief: BriefForPrompt): string {
  const lines = [
    `Product: ${brief.productName}`,
    brief.productCategory && `Category: ${brief.productCategory}`,
    brief.productPrice && `Price: ${brief.productPrice}`,
    brief.productDescription && `About the product: ${brief.productDescription}`,
    `Campaign goal: ${GOAL_OPTIONS[brief.goal].label} — ${GOAL_OPTIONS[brief.goal].description}`,
    `Style: ${STYLE_OPTIONS[brief.style].label} — ${STYLE_OPTIONS[brief.style].description}`,
    `Platforms: ${brief.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}`,
    brief.audienceAgeRange && `Audience age: ${brief.audienceAgeRange}`,
    brief.audienceLocation && `Audience location: ${brief.audienceLocation}`,
    brief.audienceInterests?.length && `Audience interests: ${brief.audienceInterests.join(', ')}`,
    brief.audienceCustomerType && `Customer type: ${brief.audienceCustomerType}`,
    brief.audiencePainPoints && `Pain points: ${brief.audiencePainPoints}`,
  ]
  return lines.filter(Boolean).join('\n')
}

const ROLE = `You are Nexa, a senior marketing strategist and copywriter. You build complete,
specific, ready-to-use marketing campaigns for small businesses, creators and
marketers. Write for the product and audience you are given — never generic
advice, never placeholder text like "[Product Name]". Do not invent facts about
the product (prices, awards, ingredients, results, testimonials) that are not in
the brief or brand; where a claim would need evidence, write around it.`

const PLAN_SHAPE = `Reply with ONE JSON object and nothing else — no prose, no code fence. Shape:
{
  "strategy": { "summary": string, "objective": string, "keyMessage": string,
                "phases": [{ "name": string, "focus": string }] },   // 2–4 phases
  "audienceSummary": string,
  "positioning": string,
  "marketingAngle": string,
  "hook": string,                       // the single strongest opening line
  "alternativeHooks": [string],         // exactly 5, each a different approach
  "contentIdeas": [{ "title": string, "platform": PLATFORM, "format": FORMAT, "description": string }],  // 6–8
  "videoConcepts": [{ "title": string, "hook": string, "concept": string, "platform": PLATFORM }],       // 3
  "adCopy": [{ "platform": PLATFORM, "headline": string, "primaryText": string, "description": string }], // 3
  "socialCaptions": [{ "platform": PLATFORM, "caption": string, "hashtags": [string] }],               // 3–4
  "ctas": [string],                     // 4–5 short calls to action
  "calendar": [{ "day": number, "platform": PLATFORM, "format": FORMAT, "title": string, "notes": string }] // 14 days, day 1–14
}
PLATFORM is one of: ${PLATFORMS.join(', ')} — use only the platforms in the brief.
FORMAT is one of: ${FORMATS.join(', ')}.
Write every string in plain text (no Markdown). Keep captions and ad text within each platform's norms.`

export function buildCampaignPrompt(brief: BriefForPrompt, brandBlock: string | null) {
  const system = [ROLE, brandBlock, PLAN_SHAPE].filter(Boolean).join('\n\n')
  const user = `Build the full campaign for this brief.\n\n${describeBrief(brief)}`
  return { system, user }
}

/** What each regenerable kind is, in words the model is asked for. */
const ITEM_SHAPE: Record<ItemKind, string> = {
  ALT_HOOK: '{ "item": string }  // one opening hook',
  CONTENT_IDEA:
    '{ "item": { "title": string, "platform": PLATFORM, "format": FORMAT, "description": string } }',
  VIDEO_CONCEPT:
    '{ "item": { "title": string, "hook": string, "concept": string, "platform": PLATFORM } }',
  AD_COPY:
    '{ "item": { "platform": PLATFORM, "headline": string, "primaryText": string, "description": string } }',
  SOCIAL_CAPTION: '{ "item": { "platform": PLATFORM, "caption": string, "hashtags": [string] } }',
  CTA: '{ "item": string }  // one short call to action',
  CONTENT_CALENDAR:
    '{ "item": { "day": number, "platform": PLATFORM, "format": FORMAT, "title": string, "notes": string } }',
}

export const KIND_LABEL: Record<AssetKind, string> = {
  STRATEGY: 'Strategy',
  AUDIENCE_SUMMARY: 'Audience',
  POSITIONING: 'Positioning',
  MARKETING_ANGLE: 'Main angle',
  HOOK: 'Main hook',
  ALT_HOOK: 'Alternative hook',
  CONTENT_IDEA: 'Content idea',
  VIDEO_CONCEPT: 'Video concept',
  AD_COPY: 'Ad copy',
  SOCIAL_CAPTION: 'Social caption',
  CTA: 'Call to action',
  CONTENT_CALENDAR: 'Calendar slot',
}

/**
 * Asks for one replacement piece. The current version and its siblings are
 * shown so the replacement is genuinely different from both.
 */
export function buildItemPrompt(options: {
  kind: ItemKind
  brief: BriefForPrompt
  brandBlock: string | null
  strategy: string | null
  current: string
  siblings: string[]
  day?: number
}) {
  const system = [
    ROLE,
    options.brandBlock,
    `Reply with ONE JSON object and nothing else. Shape:\n${ITEM_SHAPE[options.kind]}\n` +
      `PLATFORM is one of: ${options.brief.platforms.join(', ')}. FORMAT is one of: ${FORMATS.join(', ')}.\n` +
      'Write in plain text (no Markdown).',
  ]
    .filter(Boolean)
    .join('\n\n')

  const user = [
    `Write a new ${KIND_LABEL[options.kind].toLowerCase()} for this campaign, replacing the current one.`,
    options.day ? `Keep it on day ${options.day}.` : null,
    `Brief:\n${describeBrief(options.brief)}`,
    options.strategy ? `Campaign strategy:\n${options.strategy}` : null,
    `Current version (write something clearly different):\n${options.current}`,
    options.siblings.length > 0
      ? `Others already in the campaign (do not repeat these):\n${options.siblings.map((s) => `- ${s}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}

export function parseItem(kind: ItemKind, reply: string): ParseResult<unknown> {
  const json = extractJson(reply) as { item?: unknown } | null
  if (!json || !('item' in json)) return { ok: false, reason: 'not_json' }
  const parsed = ITEM_KINDS[kind].schema.safeParse(json.item)
  if (!parsed.success) return { ok: false, reason: 'invalid_item' }
  return { ok: true, value: parsed.data }
}
