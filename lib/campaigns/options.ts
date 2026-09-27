import { z } from 'zod'

/**
 * The choices a campaign brief is made of, their labels, and the brief's
 * validation. Pure, so the wizard, the API and the prompt share one list and
 * the enum values can never drift from the schema's.
 */

export const GOALS = [
  'SALES',
  'LEADS',
  'BRAND_AWARENESS',
  'PRODUCT_LAUNCH',
  'ENGAGEMENT',
  'WEBSITE_TRAFFIC',
] as const
export type CampaignGoal = (typeof GOALS)[number]

export const STYLES = [
  'PROFESSIONAL',
  'UGC',
  'EDUCATIONAL',
  'STORYTELLING',
  'PROMOTIONAL',
  'LUXURY',
  'FUN',
  'MINIMAL',
] as const
export type CampaignStyle = (typeof STYLES)[number]

export const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'WHATSAPP', 'GOOGLE'] as const
export type Platform = (typeof PLATFORMS)[number]

export const FORMATS = ['POST', 'REEL', 'STORY', 'SHORT', 'CAROUSEL', 'CAPTION', 'AD'] as const
export type ContentFormat = (typeof FORMATS)[number]

export const CAMPAIGN_STATUSES = ['DRAFT', 'GENERATING', 'READY', 'ACTIVE', 'ARCHIVED'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const GOAL_OPTIONS: Record<CampaignGoal, { label: string; description: string }> = {
  SALES: { label: 'Sales', description: 'Get people to buy.' },
  LEADS: { label: 'Leads', description: 'Collect sign-ups, enquiries or bookings.' },
  BRAND_AWARENESS: { label: 'Brand awareness', description: 'Get known by the right people.' },
  PRODUCT_LAUNCH: { label: 'Product launch', description: 'Make a new product land.' },
  ENGAGEMENT: { label: 'Engagement', description: 'Comments, shares, saves and follows.' },
  WEBSITE_TRAFFIC: { label: 'Website traffic', description: 'Send people to your site.' },
}

export const STYLE_OPTIONS: Record<CampaignStyle, { label: string; description: string }> = {
  PROFESSIONAL: { label: 'Professional', description: 'Clear, credible, polished.' },
  UGC: { label: 'UGC', description: 'Feels like a real customer made it.' },
  EDUCATIONAL: { label: 'Educational', description: 'Teaches something useful.' },
  STORYTELLING: { label: 'Storytelling', description: 'A narrative people follow.' },
  PROMOTIONAL: { label: 'Promotional', description: 'Offers, urgency, direct asks.' },
  LUXURY: { label: 'Luxury', description: 'Understated, premium, aspirational.' },
  FUN: { label: 'Fun', description: 'Playful, light, shareable.' },
  MINIMAL: { label: 'Minimal', description: 'Few words, strong visuals.' },
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  WHATSAPP: 'WhatsApp',
  GOOGLE: 'Google',
}

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  POST: 'Post',
  REEL: 'Reel',
  STORY: 'Story',
  SHORT: 'Short',
  CAROUSEL: 'Carousel',
  CAPTION: 'Caption',
  AD: 'Ad',
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  GENERATING: 'Generating',
  READY: 'Ready',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
}

export const CUSTOMER_TYPES = [
  'Consumers (B2C)',
  'Businesses (B2B)',
  'First-time buyers',
  'Returning customers',
  'Gift buyers',
] as const

// ---------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------

function optionalText(max: number, label: string) {
  return z
    .string()
    .max(max, `${label} can be at most ${max.toLocaleString('en-US')} characters.`)
    .transform((value) => value.trim() || null)
    .nullable()
    .optional()
}

/**
 * A new product typed into the wizard rather than picked from the Brand Kit.
 * It is saved as a real Product so the next campaign can pick it.
 */
export const newProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the product a name.')
    .max(120, 'Product names can be at most 120 characters.'),
  description: optionalText(2000, 'The description'),
  category: optionalText(80, 'The category'),
  price: optionalText(40, 'The price'),
})

export const campaignBriefSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(120, 'Campaign names can be at most 120 characters.')
      .optional()
      .transform((value) => value || null),
    brandId: z.string().min(1).max(40).nullable().optional(),
    /** Either an existing product… */
    productId: z.string().min(1).max(40).nullable().optional(),
    /** …or a new one. */
    product: newProductSchema.nullable().optional(),
    goal: z.enum(GOALS, 'Choose a goal.'),
    style: z.enum(STYLES, 'Choose a style.'),
    platforms: z
      .array(z.enum(PLATFORMS))
      .min(1, 'Choose at least one platform.')
      .max(PLATFORMS.length)
      .transform((list) => [...new Set(list)]),
    audienceAgeRange: optionalText(40, 'The age range'),
    audienceLocation: optionalText(120, 'The location'),
    audienceInterests: z
      .array(z.string().trim().min(1).max(40, 'Interests can be at most 40 characters each.'))
      .max(12, 'Up to 12 interests.')
      .default([]),
    audienceCustomerType: optionalText(60, 'The customer type'),
    audiencePainPoints: optionalText(2000, 'Pain points'),
  })
  .superRefine((brief, ctx) => {
    if (!brief.productId && !brief.product) {
      ctx.addIssue({ code: 'custom', path: ['product', 'name'], message: 'Pick a product or describe a new one.' })
    }
  })

export type CampaignBrief = z.infer<typeof campaignBriefSchema>

/** What a campaign is called when the user does not name it. */
export function defaultCampaignName(productName: string, goal: CampaignGoal): string {
  return `${productName} — ${GOAL_OPTIONS[goal].label}`.slice(0, 120)
}

/**
 * A generation that has been "running" this long is treated as dead — the
 * server was restarted or the function was killed — so the user can retry
 * instead of watching a spinner forever. Longer than the route's maxDuration.
 */
export const GENERATION_STALE_MS = 6 * 60 * 1000

export function isGenerationStale(status: string, updatedAt: Date, now = new Date()): boolean {
  return status === 'GENERATING' && now.getTime() - updatedAt.getTime() > GENERATION_STALE_MS
}
