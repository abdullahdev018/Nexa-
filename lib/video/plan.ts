import { z } from 'zod'
import { PLATFORMS, PLATFORM_LABEL, type Platform } from '@/lib/campaigns/options'
import { extractJson, type ParseResult } from '@/lib/campaigns/plan'

/**
 * Video plans: what can be asked for, what a plan is, and how the model is
 * asked for one. Pure.
 *
 * Nexa writes the plan. It does not render video — rendering needs a video
 * provider, and none is connected. Nothing in this module or the UI built on
 * it may suggest otherwise.
 */

export const VIDEO_TYPES = [
  'PRODUCT_SHOWCASE',
  'UGC',
  'PROBLEM_SOLUTION',
  'TESTIMONIAL',
  'PROMOTIONAL',
  'EDUCATIONAL',
  'FOUNDER_STORY',
  'PRODUCT_LAUNCH',
] as const
export type VideoType = (typeof VIDEO_TYPES)[number]

export const VIDEO_TYPE_OPTIONS: Record<VideoType, { label: string; description: string }> = {
  PRODUCT_SHOWCASE: { label: 'Product showcase', description: 'The product, beautifully, and what it does.' },
  UGC: { label: 'UGC', description: 'A real customer talking to camera.' },
  PROBLEM_SOLUTION: { label: 'Problem / solution', description: 'The frustration, then the fix.' },
  TESTIMONIAL: { label: 'Testimonial', description: 'A customer story — written as a script for a real customer to tell.' },
  PROMOTIONAL: { label: 'Promotional', description: 'An offer, with urgency and a clear ask.' },
  EDUCATIONAL: { label: 'Educational', description: 'Teach something useful; the product is the example.' },
  FOUNDER_STORY: { label: 'Founder story', description: 'Why you started, told by you.' },
  PRODUCT_LAUNCH: { label: 'Product launch', description: 'Something new, and why it matters now.' },
}

export const DURATIONS = [15, 30, 45, 60, 90] as const

/** Vertical short-form lives on these; Google and WhatsApp are not video-first. */
export const VIDEO_PLATFORMS: Platform[] = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'FACEBOOK']

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((value) => value.trim() || null)
    .nullable()
    .optional()

export const videoRequestSchema = z
  .object({
    type: z.enum(VIDEO_TYPES, 'Choose a video type.'),
    platform: z.enum(PLATFORMS, 'Choose a platform.'),
    durationSeconds: z.coerce
      .number()
      .int()
      .refine((value) => (DURATIONS as readonly number[]).includes(value), 'Choose a length.'),
    productId: z.string().min(1).max(40).nullable().optional(),
    campaignId: z.string().min(1).max(40).nullable().optional(),
    /** The campaign video concept this plan develops. */
    conceptId: z.string().min(1).max(40).nullable().optional(),
    goal: optionalText(300, 'The goal'),
    audience: optionalText(300, 'The audience'),
    tone: optionalText(120, 'The tone'),
    notes: optionalText(1000, 'Notes'),
  })
  .superRefine((request, ctx) => {
    if (!VIDEO_PLATFORMS.includes(request.platform)) {
      ctx.addIssue({ code: 'custom', path: ['platform'], message: 'Choose a video platform.' })
    }
    if (request.conceptId && !request.campaignId) {
      ctx.addIssue({ code: 'custom', path: ['conceptId'], message: 'A video concept belongs to a campaign.' })
    }
  })

export type VideoRequest = z.infer<typeof videoRequestSchema>

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

const line = (max: number) => z.string().trim().min(1).max(max)
const maybe = (max: number) =>
  z
    .string()
    .nullish()
    .transform((value) => value?.trim().slice(0, max) || null)
    .catch(null)

export const sceneSchema = z.object({
  start: z.coerce.number().min(0).max(600),
  end: z.coerce.number().min(0).max(600),
  /** Framing and camera: "Close-up, handheld, slow push in". */
  shot: line(200),
  visual: line(600),
  onScreenText: maybe(200),
  voiceover: maybe(600),
  sound: maybe(200),
})

export type Scene = z.infer<typeof sceneSchema>

/**
 * The stored plan. The same schema validates what the model returns and what
 * the editor saves, so a hand-edited plan can never be shaped differently
 * from a generated one.
 */
export const videoPlanSchema = z.object({
  title: line(160),
  hook: z.object({ line: line(300), visual: line(400), onScreenText: maybe(200) }),
  scenes: z.array(sceneSchema).min(2).max(20),
  cta: z.object({ line: line(200), onScreenText: maybe(200) }),
  music: maybe(300),
  shotList: z
    .array(z.string())
    .catch([])
    .default([])
    .transform((items) => items.map((item) => item.trim().slice(0, 200)).filter(Boolean).slice(0, 25)),
  thumbnail: maybe(300),
  caption: maybe(2200),
})

export type VideoPlan = z.infer<typeof videoPlanSchema>

/**
 * Puts scenes in order and makes the timings add up: each scene starts where
 * the last ended, none is shorter than a second, and the last ends at the
 * target length. The model's timings are a suggestion; the edit must be sane.
 *
 * `keepOrder` is for hand edits: the editor's order is the user's intent, even
 * when a newly added scene carries a placeholder start time.
 */
export function normaliseTimings(
  scenes: Scene[],
  durationSeconds: number,
  { keepOrder = false }: { keepOrder?: boolean } = {},
): Scene[] {
  const sorted = keepOrder ? [...scenes] : [...scenes].sort((a, b) => a.start - b.start)
  // Every scene gets at least a second, so there can be no more scenes than seconds.
  const ordered = sorted.slice(0, Math.max(1, durationSeconds))
  const weights = ordered.map((scene) => Math.max(1, scene.end - scene.start))
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  let cursor = 0
  return ordered.map((scene, index) => {
    const last = index === ordered.length - 1
    const length = Math.max(1, Math.round((weights[index] / total) * durationSeconds))
    const start = cursor
    const end = last ? Math.max(start + 1, durationSeconds) : Math.min(start + length, durationSeconds - (ordered.length - index - 1))
    cursor = end
    return { ...scene, start, end }
  })
}

export function parseVideoPlan(reply: string, durationSeconds: number): ParseResult<VideoPlan> {
  const json = extractJson(reply)
  if (!json) return { ok: false, reason: 'not_json' }
  const parsed = videoPlanSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, reason: `invalid:${parsed.error.issues[0]?.path.join('.') || 'root'}` }
  }
  return { ok: true, value: { ...parsed.data, scenes: normaliseTimings(parsed.data.scenes, durationSeconds) } }
}

function stamp(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** The whole plan as plain text — for copying into a doc or sending to a crew. */
export function planToText(plan: VideoPlan): string {
  const parts = [
    plan.title.toUpperCase(),
    `HOOK\n${plan.hook.line}\nVisual: ${plan.hook.visual}${plan.hook.onScreenText ? `\nOn screen: ${plan.hook.onScreenText}` : ''}`,
    'SCENES\n' +
      plan.scenes
        .map((scene) =>
          [
            `${stamp(scene.start)}–${stamp(scene.end)}  ${scene.shot}`,
            `  Visual: ${scene.visual}`,
            scene.onScreenText && `  On screen: ${scene.onScreenText}`,
            scene.voiceover && `  Voiceover: ${scene.voiceover}`,
            scene.sound && `  Sound: ${scene.sound}`,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n\n'),
    `CALL TO ACTION\n${plan.cta.line}${plan.cta.onScreenText ? `\nOn screen: ${plan.cta.onScreenText}` : ''}`,
    plan.music && `MUSIC\n${plan.music}`,
    plan.shotList.length > 0 && `SHOT LIST\n${plan.shotList.map((shot) => `- ${shot}`).join('\n')}`,
    plan.thumbnail && `THUMBNAIL\n${plan.thumbnail}`,
    plan.caption && `CAPTION\n${plan.caption}`,
  ]
  return parts.filter(Boolean).join('\n\n')
}

/** Just the words to be spoken, in order — what a presenter reads. */
export function voiceoverScript(plan: VideoPlan): string {
  return [plan.hook.line, ...plan.scenes.map((scene) => scene.voiceover), plan.cta.line]
    .filter(Boolean)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export interface VideoPromptContext {
  type: VideoType
  platform: Platform
  durationSeconds: number
  brandBlock: string | null
  product?: string | null
  campaign?: string | null
  concept?: string | null
  goal?: string | null
  audience?: string | null
  tone?: string | null
  notes?: string | null
  /** Set when replacing a plan, so the new one is genuinely different. */
  previous?: string | null
}

const ROLE = `You are Nexa, a short-form video director and scriptwriter. You write
shootable plans: every scene says exactly what the camera sees, how it is
framed, what text is on screen and what is said. Plans must be achievable by a
small business with a phone. Never invent facts, results, reviews or quotes
about the product that are not given. For testimonial or UGC videos, write
prompts and direction for a real customer to speak in their own words — never
a fabricated quote presented as a real person's.`

export function buildVideoPrompt(context: VideoPromptContext) {
  const system = [
    ROLE,
    context.brandBlock,
    `Reply with ONE JSON object and nothing else — no prose, no code fence. Shape:
{
  "title": string,
  "hook": { "line": string (spoken or shown in the first 2 seconds), "visual": string, "onScreenText": string },
  "scenes": [ { "start": number (seconds), "end": number (seconds), "shot": string (framing and camera movement),
                "visual": string, "onScreenText": string, "voiceover": string, "sound": string } ],   // 4–8 scenes
  "cta": { "line": string, "onScreenText": string },
  "music": string (mood and tempo, no copyrighted track names),
  "shotList": [string] (every shot and prop to capture on the day),
  "thumbnail": string,
  "caption": string
}
The scenes run from 0 to ${context.durationSeconds} seconds with no gaps. Plain text only — no Markdown.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const user = [
    `Plan a ${context.durationSeconds}-second ${VIDEO_TYPE_OPTIONS[context.type].label.toLowerCase()} video for ${PLATFORM_LABEL[context.platform]} (vertical 9:16).`,
    `Type: ${VIDEO_TYPE_OPTIONS[context.type].description}`,
    context.product && `Product:\n${context.product}`,
    context.concept && `It develops this video concept from the campaign:\n${context.concept}`,
    context.campaign && `Campaign:\n${context.campaign}`,
    context.goal && `Goal: ${context.goal}`,
    context.audience && `Audience: ${context.audience}`,
    context.tone && `Tone: ${context.tone}`,
    context.notes && `Notes from the user: ${context.notes}`,
    context.previous && `Replace this previous plan with a clearly different approach:\n${context.previous.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}
