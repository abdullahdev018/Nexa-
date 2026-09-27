import { z } from 'zod'
import { PLATFORMS, type ContentFormat, type Platform } from '@/lib/campaigns/options'

/**
 * What the Content Studio can make, per platform, and the request shape.
 * Pure, so the composer and the API agree on which combinations exist.
 */

/**
 * Organic formats each platform actually has. Ads are Ad Studio's job, so the
 * AD format never appears here.
 */
export const PLATFORM_FORMATS: Record<Platform, ContentFormat[]> = {
  INSTAGRAM: ['POST', 'REEL', 'CAROUSEL', 'STORY', 'CAPTION'],
  FACEBOOK: ['POST', 'REEL', 'STORY', 'CAPTION'],
  TIKTOK: ['SHORT', 'CAROUSEL', 'CAPTION'],
  YOUTUBE: ['SHORT', 'POST', 'CAPTION'],
  WHATSAPP: ['POST', 'STORY'],
  GOOGLE: ['POST'],
}

/** What each format means on the page, in the user's terms. */
export const FORMAT_HINT: Record<ContentFormat, string> = {
  POST: 'A single post: the copy plus direction for the image.',
  REEL: 'A short vertical video: hook, scene-by-scene script and caption.',
  SHORT: 'A short vertical video: hook, scene-by-scene script and caption.',
  STORY: 'Three to five frames with overlay text and a call to action.',
  CAROUSEL: 'Five to eight slides, plus the caption.',
  CAPTION: 'Caption only, ready to paste.',
  AD: 'Ad copy — made in Ad Studio.',
}

export function isValidCombination(platform: Platform, format: ContentFormat): boolean {
  return PLATFORM_FORMATS[platform].includes(format)
}

export const MAX_VARIATIONS = 3

export const MANUAL_STATUSES = ['DRAFT', 'READY'] as const

export const generateContentSchema = z
  .object({
    platform: z.enum(PLATFORMS, 'Choose a platform.'),
    format: z.enum(['POST', 'REEL', 'STORY', 'SHORT', 'CAROUSEL', 'CAPTION'], 'Choose a format.'),
    topic: z
      .string()
      .trim()
      .min(3, 'Say what the content is about.')
      .max(1000, 'Keep the topic under 1,000 characters.'),
    instructions: z
      .string()
      .max(1000, 'Keep extra instructions under 1,000 characters.')
      .transform((value) => value.trim() || null)
      .nullable()
      .optional(),
    variations: z.coerce.number().int().min(1).max(MAX_VARIATIONS).default(1),
    campaignId: z.string().min(1).max(40).nullable().optional(),
    /** A content idea from the campaign this piece is built from. */
    ideaId: z.string().min(1).max(40).nullable().optional(),
    brandId: z.string().min(1).max(40).nullable().optional(),
  })
  .superRefine((request, ctx) => {
    if (!isValidCombination(request.platform, request.format)) {
      ctx.addIssue({ code: 'custom', path: ['format'], message: 'That format is not available on this platform.' })
    }
    if (request.ideaId && !request.campaignId) {
      ctx.addIssue({ code: 'custom', path: ['ideaId'], message: 'A content idea belongs to a campaign.' })
    }
  })

export type GenerateContentRequest = z.infer<typeof generateContentSchema>

export const updateContentSchema = z
  .object({
    title: z
      .string()
      .max(160, 'Titles can be at most 160 characters.')
      .transform((value) => value.trim() || null)
      .nullable()
      .optional(),
    body: z.string().trim().min(1, 'This cannot be empty.').max(10_000, 'This is too long.').optional(),
    /**
     * Only the states a person can honestly set. SCHEDULED comes from the
     * calendar and PUBLISHED from a real publish — neither is a checkbox.
     */
    status: z
      .enum(MANUAL_STATUSES, 'Only Draft or Ready can be set here. Scheduled comes from the calendar.')
      .optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.body !== undefined || value.status !== undefined,
    'Nothing to change.',
  )
