import { z } from 'zod'
import { planAllows, type PlanId } from '@/lib/billing/plans'

/**
 * The Brand Kit's shape, validation and plan rules.
 *
 * Pure — no database, no server-only imports — so the API, the form and the
 * prompt builder all agree on one definition, and the rules can be tested.
 */

export const MAX_COLORS = 12
export const MAX_FONTS = 6
export const MAX_PRODUCTS_PER_BRAND = 50

export const FONT_ROLES = ['heading', 'body', 'accent'] as const
export type FontRole = (typeof FONT_ROLES)[number]

export interface BrandColor {
  name: string
  hex: string
}

export interface BrandFont {
  role: FontRole
  family: string
}

/**
 * The fields that make up the full kit. The Free plan may keep one brand's
 * identity — name, website, description, audience — because a campaign needs
 * something to be about. The kit itself is a Starter feature.
 */
export const KIT_FIELDS = ['logoUrl', 'colors', 'fonts', 'toneOfVoice', 'guidelines'] as const
export type KitField = (typeof KIT_FIELDS)[number]

/** Offered as one-tap chips beside the tone field. Free text is still allowed. */
export const TONE_SUGGESTIONS = [
  'Friendly',
  'Premium',
  'Playful',
  'Bold',
  'Professional',
  'Warm',
  'Witty',
  'Minimal',
  'Expert',
  'Down-to-earth',
] as const

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

/** Trims, and turns an empty string into null so "cleared" is stored as absent. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .max(max, `${label} can be at most ${max.toLocaleString('en-US')} characters.`)
    .transform((value) => value.trim() || null)
    .nullable()
    .optional()
}

/**
 * A web address. A bare domain gets `https://` added, because "acme.com" is
 * what people type. Only http and https are accepted — never `javascript:` —
 * since these values are rendered as links and images.
 */
function optionalUrl(label: string) {
  return z
    .string()
    .max(2048, `${label} is too long.`)
    .transform((value, ctx) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
      try {
        const url = new URL(candidate)
        if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')) {
          return url.toString()
        }
      } catch {
        // Falls through to the issue below.
      }
      ctx.addIssue({ code: 'custom', message: `Enter a valid web address for ${label.toLowerCase()}.` })
      return z.NEVER
    })
    .nullable()
    .optional()
}

export const colorSchema = z.object({
  name: z.string().trim().max(40, 'Colour names can be at most 40 characters.').default(''),
  hex: z
    .string()
    .trim()
    .regex(/^#?[0-9a-f]{6}$/i, 'Use a six-digit hex colour, like #4F46E5.')
    .transform((value) => `#${value.replace('#', '').toUpperCase()}`),
})

export const fontSchema = z.object({
  role: z.enum(FONT_ROLES),
  family: z.string().trim().min(1, 'Enter a font name.').max(60, 'Font names can be at most 60 characters.'),
})

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

/**
 * Every field is optional so the same schema serves create and update: a key
 * that is left out is left unchanged (Prisma ignores `undefined`), and a key
 * sent as "" or null is cleared.
 */
export const brandFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the brand a name.')
    .max(80, 'Brand names can be at most 80 characters.')
    .optional(),
  website: optionalUrl('Website'),
  logoUrl: optionalUrl('Logo URL'),
  description: optionalText(2000, 'The description'),
  audience: optionalText(2000, 'The audience'),
  toneOfVoice: optionalText(300, 'Tone of voice'),
  guidelines: optionalText(4000, 'Guidelines'),
  colors: z.array(colorSchema).max(MAX_COLORS, `A brand can have up to ${MAX_COLORS} colours.`).optional(),
  fonts: z.array(fontSchema).max(MAX_FONTS, `A brand can have up to ${MAX_FONTS} fonts.`).optional(),
})

export const createBrandSchema = brandFieldsSchema.extend({
  name: brandFieldsSchema.shape.name.unwrap(),
})

export const updateBrandSchema = brandFieldsSchema.extend({
  /** Only ever `true`: a brand stops being the default by another becoming it. */
  isDefault: z.literal(true).optional(),
})

export type BrandFieldsInput = z.infer<typeof brandFieldsSchema>

/**
 * The kit fields a request tries to set that the plan does not include.
 *
 * Only non-empty values count, so a Free workspace can still clear a field —
 * or send an empty one — without being refused.
 */
export function lockedKitFields(input: BrandFieldsInput, plan: PlanId): KitField[] {
  if (planAllows(plan, 'brandKit')) return []
  return KIT_FIELDS.filter((field) => {
    const value = input[field]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  })
}

// ---------------------------------------------------------------------------
// Stored values
// ---------------------------------------------------------------------------

/** Reads the `colors` JSON column, dropping anything malformed rather than throwing. */
export function parseColors(value: unknown): BrandColor[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = colorSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export function parseFonts(value: unknown): BrandFont[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = fontSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

/** A brand as the app works with it, with the JSON columns decoded. */
export interface BrandProfile {
  id: string
  name: string
  website: string | null
  logoUrl: string | null
  description: string | null
  audience: string | null
  toneOfVoice: string | null
  guidelines: string | null
  colors: BrandColor[]
  fonts: BrandFont[]
  isDefault: boolean
}

export interface BrandRow extends Omit<BrandProfile, 'colors' | 'fonts'> {
  colors: unknown
  fonts: unknown
}

export function toBrandProfile(row: BrandRow): BrandProfile {
  return { ...row, colors: parseColors(row.colors), fonts: parseFonts(row.fonts) }
}

/**
 * What a plan may *use* of a stored brand. A workspace that downgrades keeps
 * its saved kit — nothing is deleted — but generations stop reading it until
 * the plan includes it again.
 */
export function brandForPlan(brand: BrandProfile, plan: PlanId): BrandProfile {
  if (planAllows(plan, 'brandKit')) return brand
  return { ...brand, logoUrl: null, toneOfVoice: null, guidelines: null, colors: [], fonts: [] }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const productFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the product a name.')
    .max(120, 'Product names can be at most 120 characters.')
    .optional(),
  description: optionalText(2000, 'The description'),
  url: optionalUrl('Product page'),
  imageUrl: optionalUrl('Image URL'),
  category: optionalText(80, 'The category'),
  price: optionalText(40, 'The price'),
})

export const createProductSchema = productFieldsSchema.extend({
  name: productFieldsSchema.shape.name.unwrap(),
})

export interface BrandProduct {
  id: string
  name: string
  description: string | null
  url: string | null
  imageUrl: string | null
  category: string | null
  price: string | null
}

/** The column list every brand query selects, so the shape is written once. */
export const BRAND_SELECT = {
  id: true,
  name: true,
  website: true,
  logoUrl: true,
  description: true,
  audience: true,
  toneOfVoice: true,
  guidelines: true,
  colors: true,
  fonts: true,
  isDefault: true,
} as const

export const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  url: true,
  imageUrl: true,
  category: true,
  price: true,
} as const
