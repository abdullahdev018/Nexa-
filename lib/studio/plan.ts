import { z } from 'zod'
import {
  FORMAT_LABEL,
  PLATFORM_LABEL,
  type ContentFormat,
  type Platform,
} from '@/lib/campaigns/options'
import { extractJson, type ParseResult } from '@/lib/campaigns/plan'

/**
 * How a piece of content is asked for, parsed, and turned into ready-to-post
 * text. Pure.
 *
 * The model returns structure (slides, scenes, frames); it is flattened into
 * one plain-text body with labelled sections, because that is what someone
 * edits and pastes — and it keeps the Content table free of per-format shapes.
 */

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

function capped<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((items) =>
      items
        .map((entry) => item.safeParse(entry))
        .flatMap((result) => (result.success ? [result.data as z.output<T>] : []))
        .slice(0, max),
    )
}

const hashtags = z
  .array(z.unknown())
  .catch([])
  .default([])
  .transform((tags) =>
    tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().replace(/^#*/, '').replace(/\s+/g, ''))
      .filter(Boolean)
      .slice(0, 20)
      .map((tag) => `#${tag}`),
  )

export const variationSchema = z.object({
  title: text(160),
  hook: optionalText(300),
  /** Posts: the post copy. Captions: the caption. Video/story: optional intro. */
  body: optionalText(4000),
  visual: optionalText(800),
  slides: capped(z.object({ heading: text(120), text: optionalText(600) }), 10),
  scenes: capped(
    z.object({
      time: optionalText(20),
      visual: text(400),
      onScreenText: optionalText(200),
      voiceover: optionalText(400),
    }),
    12,
  ),
  frames: capped(z.object({ text: text(200), visual: optionalText(300) }), 6),
  caption: optionalText(2200),
  hashtags,
  cta: optionalText(160),
})

export type Variation = z.infer<typeof variationSchema>

/** What a variation must contain for its format to be usable. */
function isComplete(format: ContentFormat, variation: Variation): boolean {
  switch (format) {
    case 'REEL':
    case 'SHORT':
      return variation.scenes.length >= 2
    case 'CAROUSEL':
      return variation.slides.length >= 3
    case 'STORY':
      return variation.frames.length >= 2
    case 'CAPTION':
      return Boolean(variation.caption || variation.body)
    default:
      return Boolean(variation.body || variation.caption)
  }
}

export function parseVariations(
  reply: string,
  format: ContentFormat,
  expected: number,
): ParseResult<Variation[]> {
  const json = extractJson(reply) as { variations?: unknown } | null
  if (!json || !Array.isArray(json.variations)) return { ok: false, reason: 'not_json' }

  const usable = json.variations
    .map((entry) => variationSchema.safeParse(entry))
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((variation) => isComplete(format, variation))
    .slice(0, expected)

  // Fewer than asked is still worth keeping; none is a failure.
  if (usable.length === 0) return { ok: false, reason: 'no_usable_variation' }
  return { ok: true, value: usable }
}

/** Flattens a variation into the text a person edits and posts. */
export function variationToBody(format: ContentFormat, variation: Variation): string {
  const sections: string[] = []
  const add = (label: string, value: string | null | undefined) => {
    if (value) sections.push(`${label}\n${value}`)
  }

  if (format === 'REEL' || format === 'SHORT') {
    add('HOOK', variation.hook)
    add(
      'SCRIPT',
      variation.scenes
        .map((scene, i) => {
          const parts = [`${scene.time ?? `Scene ${i + 1}`} — ${scene.visual}`]
          if (scene.onScreenText) parts.push(`   On screen: ${scene.onScreenText}`)
          if (scene.voiceover) parts.push(`   Voiceover: ${scene.voiceover}`)
          return parts.join('\n')
        })
        .join('\n'),
    )
    add('CAPTION', variation.caption ?? variation.body)
  } else if (format === 'CAROUSEL') {
    add(
      'SLIDES',
      variation.slides
        .map((slide, i) => `${i + 1}. ${slide.heading}${slide.text ? `\n   ${slide.text}` : ''}`)
        .join('\n'),
    )
    add('CAPTION', variation.caption ?? variation.body)
  } else if (format === 'STORY') {
    add(
      'FRAMES',
      variation.frames
        .map((frame, i) => `${i + 1}. ${frame.text}${frame.visual ? `\n   Visual: ${frame.visual}` : ''}`)
        .join('\n'),
    )
  } else if (format === 'CAPTION') {
    add('CAPTION', variation.caption ?? variation.body)
  } else {
    add('HOOK', variation.hook)
    add('POST', variation.body ?? variation.caption)
    add('VISUAL', variation.visual)
  }

  add('CALL TO ACTION', variation.cta)
  if (variation.hashtags.length > 0) sections.push(variation.hashtags.join(' '))

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const FORMAT_SHAPE: Record<ContentFormat, string> = {
  POST: '"hook": string, "body": string (the post copy), "visual": string (what the image shows)',
  REEL:
    '"hook": string (first 2 seconds), "scenes": [{ "time": "0–3s", "visual": string, "onScreenText": string, "voiceover": string }] (4–7 scenes, under 45 seconds total), "caption": string',
  SHORT:
    '"hook": string (first 2 seconds), "scenes": [{ "time": "0–3s", "visual": string, "onScreenText": string, "voiceover": string }] (4–7 scenes, under 45 seconds total), "caption": string',
  STORY: '"frames": [{ "text": string (overlay text), "visual": string }] (3–5 frames)',
  CAROUSEL: '"slides": [{ "heading": string, "text": string }] (5–8 slides, first slide is the hook), "caption": string',
  CAPTION: '"caption": string',
  AD: '"body": string',
}

/** Platform norms the model should respect. */
const PLATFORM_NOTES: Record<Platform, string> = {
  INSTAGRAM: 'Instagram: the first line carries the caption; 3–8 relevant hashtags.',
  FACEBOOK: 'Facebook: conversational, fewer hashtags (0–3).',
  TIKTOK: 'TikTok: native, fast, lo-fi; the hook must land in the first second; 3–5 hashtags.',
  YOUTUBE: 'YouTube: Shorts need a strong hook and a clear payoff; hashtags sparingly.',
  WHATSAPP: 'WhatsApp: a message to people who opted in — personal, short, no hashtags.',
  GOOGLE: 'Google Business Profile post: plain, local, informative, no hashtags, under 1,500 characters.',
}

const ROLE = `You are Nexa, a senior social media copywriter. You write content that is
specific to the product, the audience and the platform — never generic, never
placeholder text like "[Product]". Do not invent facts (prices, results,
reviews, awards) that are not in what you are given.`

export interface ContentContext {
  platform: Platform
  format: ContentFormat
  topic: string
  instructions?: string | null
  variations: number
  brandBlock: string | null
  /** The campaign brief and strategy, when the piece belongs to one. */
  campaign?: string | null
  /** The content idea this piece realises, if any. */
  idea?: string | null
}

export function buildContentPrompt(context: ContentContext) {
  const system = [
    ROLE,
    context.brandBlock,
    `Reply with ONE JSON object and nothing else — no prose, no code fence. Shape:
{ "variations": [ { "title": string (a short internal name), ${FORMAT_SHAPE[context.format]}, "hashtags": [string], "cta": string } ] }
Write exactly ${context.variations} variation${context.variations === 1 ? '' : 's'}, each a genuinely different approach.
Plain text only — no Markdown. ${PLATFORM_NOTES[context.platform]}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const user = [
    `Write a ${PLATFORM_LABEL[context.platform]} ${FORMAT_LABEL[context.format].toLowerCase()}.`,
    `Topic: ${context.topic}`,
    context.idea ? `It realises this content idea from the campaign:\n${context.idea}` : null,
    context.campaign ? `Campaign:\n${context.campaign}` : null,
    context.instructions ? `Extra instructions from the user: ${context.instructions}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}

/** A replacement for one variation, shown the others so it does not repeat them. */
export function buildReplacementPrompt(context: ContentContext & { current: string; others: string[] }) {
  const base = buildContentPrompt({ ...context, variations: 1 })
  const user = [
    base.user,
    `Current version, to replace with something clearly different:\n${context.current.slice(0, 1500)}`,
    context.others.length > 0
      ? `Other variations already kept (do not repeat them):\n${context.others.map((o) => `- ${o.slice(0, 200)}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { system: base.system, user }
}
