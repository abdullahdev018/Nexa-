/**
 * Plans, credit allowances and credit prices — the single source of truth.
 *
 * Nothing here is a claim about what a generation costs Nexa to run. These are
 * product defaults, and they are config rather than database rows precisely so
 * they can be changed without a migration. The one exception is a workspace's
 * `monthlyAllowance`, which is copied onto CreditBalance when a period starts:
 * changing a number here must never retroactively rewrite what a workspace was
 * already granted.
 */

export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY'

export const PLAN_IDS = ['FREE', 'STARTER', 'PRO', 'AGENCY'] as const

/** Ordering for "does this plan include at least X" checks. */
export const PLAN_RANK: Record<PlanId, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  AGENCY: 3,
}

export interface PlanLimits {
  /** Brands a workspace may create. */
  brands: number
  /** Workspaces the owner may run — the Agency "client workspaces" feature. */
  workspaces: number
  /** People who may be invited into a workspace, including the owner. */
  teamMembers: number
  campaignBuilder: boolean
  brandKit: boolean
  contentCalendar: boolean
  videoGeneration: boolean
  competitorResearch: boolean
  analytics: boolean
  bulkGeneration: boolean
  whiteLabelReports: boolean
  clientWorkspaces: boolean
  /** Exports carry a Nexa mark on the free plan. */
  watermarkedExports: boolean
}

export interface PlanDefinition {
  id: PlanId
  name: string
  tagline: string
  /** Minor units, so money never touches floating point. */
  monthlyPriceCents: number
  /** Billed once a year. Set to ten months, i.e. two months free. */
  yearlyPriceCents: number
  monthlyCredits: number
  limits: PlanLimits
  /** Shown on the pricing card, in order. */
  highlights: Highlight[]
  mostPopular?: boolean
}

/**
 * A line on a pricing card. `soon` marks something the plan will include but
 * the product does not do yet — it is shown as "Soon", never as included.
 */
export interface Highlight {
  text: string
  soon?: boolean
}

/**
 * Plan capabilities that exist in the config but are not built yet. Every
 * pricing surface marks them "Soon" rather than selling them as included.
 * Remove a key from here in the same change that ships the feature.
 */
export const UNBUILT: ReadonlySet<keyof PlanLimits> = new Set<keyof PlanLimits>([
  'competitorResearch',
  'clientWorkspaces',
  'bulkGeneration',
  'whiteLabelReports',
])

/** Inviting people is not built, so any seat beyond the owner is "Soon". */
export const TEAM_INVITES_BUILT = false

/** The plan capability a credit price belongs to, where it is gated by one. */
const CREDIT_FEATURE_CAPABILITY: Partial<Record<CreditFeature, keyof PlanLimits>> = {
  COMPETITOR: 'competitorResearch',
}

/** False for a price whose feature does not exist yet — it is not advertised as buyable. */
export function creditFeatureBuilt(feature: CreditFeature): boolean {
  const capability = CREDIT_FEATURE_CAPABILITY[feature]
  return !capability || !UNBUILT.has(capability)
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'See what Nexa can do with your first product.',
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    monthlyCredits: 100,
    limits: {
      brands: 1,
      workspaces: 1,
      teamMembers: 1,
      campaignBuilder: true,
      brandKit: false,
      contentCalendar: false,
      videoGeneration: false,
      competitorResearch: false,
      analytics: false,
      bulkGeneration: false,
      whiteLabelReports: false,
      clientWorkspaces: false,
      watermarkedExports: true,
    },
    highlights: [
      { text: '100 credits a month' },
      { text: '1 brand — name, audience and products' },
      { text: 'Campaign builder' },
      { text: 'Content Studio and Ad Studio' },
      { text: 'AI Assistant' },
    ],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'For a solo marketer running one brand properly.',
    monthlyPriceCents: 900,
    yearlyPriceCents: 9000,
    monthlyCredits: 500,
    limits: {
      brands: 1,
      workspaces: 1,
      teamMembers: 1,
      campaignBuilder: true,
      brandKit: true,
      contentCalendar: true,
      videoGeneration: false,
      competitorResearch: false,
      analytics: false,
      bulkGeneration: false,
      whiteLabelReports: false,
      clientWorkspaces: false,
      watermarkedExports: false,
    },
    highlights: [
      { text: '500 credits a month' },
      { text: '1 brand' },
      { text: 'Full Brand Kit — voice, colours, fonts, guidelines' },
      { text: 'Campaign builder' },
      { text: 'Marketing calendar' },
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'The full marketing team, for a growing business.',
    monthlyPriceCents: 2900,
    yearlyPriceCents: 29000,
    monthlyCredits: 2000,
    limits: {
      brands: 5,
      workspaces: 1,
      teamMembers: 3,
      campaignBuilder: true,
      brandKit: true,
      contentCalendar: true,
      videoGeneration: true,
      competitorResearch: true,
      analytics: true,
      bulkGeneration: false,
      whiteLabelReports: false,
      clientWorkspaces: false,
      watermarkedExports: false,
    },
    highlights: [
      { text: '2,000 credits a month' },
      { text: '5 brands' },
      { text: 'AI video plans' },
      { text: 'Analytics and Nexa Insights' },
      { text: 'Nexa Deep in the AI Assistant' },
      { text: 'Up to 3 team members', soon: true },
      { text: 'Competitor research', soon: true },
    ],
    mostPopular: true,
  },
  AGENCY: {
    id: 'AGENCY',
    name: 'Agency',
    tagline: 'Run many clients out of one account.',
    monthlyPriceCents: 7900,
    yearlyPriceCents: 79000,
    monthlyCredits: 7000,
    limits: {
      brands: 20,
      workspaces: 20,
      teamMembers: 20,
      campaignBuilder: true,
      brandKit: true,
      contentCalendar: true,
      videoGeneration: true,
      competitorResearch: true,
      analytics: true,
      bulkGeneration: true,
      whiteLabelReports: true,
      clientWorkspaces: true,
      watermarkedExports: false,
    },
    highlights: [
      { text: '7,000 credits a month' },
      { text: '20 brands' },
      { text: 'Everything in Pro' },
      { text: 'Client workspaces', soon: true },
      { text: 'Up to 20 team members', soon: true },
      { text: 'Bulk generation', soon: true },
      { text: 'White-label reports', soon: true },
    ],
  },
}

export const PLAN_LIST: PlanDefinition[] = PLAN_IDS.map((id) => PLANS[id])

export function getPlan(id: PlanId | string | null | undefined): PlanDefinition {
  return PLANS[(id ?? 'FREE') as PlanId] ?? PLANS.FREE
}

/** True when `plan` is at least `required` in the ladder above. */
export function planIncludes(plan: PlanId, required: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required]
}

export function planAllows(plan: PlanId, limit: keyof PlanLimits): boolean {
  return Boolean(getPlan(plan).limits[limit])
}

/** The numeric caps read as counts rather than booleans. */
export function planLimit(plan: PlanId, limit: 'brands' | 'workspaces' | 'teamMembers'): number {
  return getPlan(plan).limits[limit]
}

// ---------------------------------------------------------------------------
// Credit prices
// ---------------------------------------------------------------------------

/**
 * What each kind of generation costs. Mirrors the AIFeature enum in the
 * schema. Changing a number here changes it everywhere, immediately.
 */
export type CreditFeature =
  | 'CHAT'
  | 'CAMPAIGN'
  | 'CONTENT'
  | 'VIDEO_PLAN'
  | 'AD'
  | 'COMPETITOR'
  | 'CALENDAR'
  | 'INSIGHTS'

export const CREDIT_COSTS: Record<CreditFeature, number> = {
  CHAT: 1,
  CAMPAIGN: 25,
  CONTENT: 3,
  VIDEO_PLAN: 8,
  AD: 5,
  COMPETITOR: 15,
  CALENDAR: 10,
  INSIGHTS: 5,
}

/** Human labels for the usage history and the "not enough credits" message. */
export const CREDIT_FEATURE_LABEL: Record<CreditFeature, string> = {
  CHAT: 'AI Assistant',
  CAMPAIGN: 'Campaign generation',
  CONTENT: 'Content generation',
  VIDEO_PLAN: 'Video plan',
  AD: 'Ad generation',
  COMPETITOR: 'Competitor research',
  CALENDAR: 'Content calendar',
  INSIGHTS: 'Nexa Insights',
}

export function creditCost(feature: CreditFeature): number {
  return CREDIT_COSTS[feature] ?? 1
}

/** Formats minor units as a price. Whole amounts drop the decimals. */
export function formatPrice(cents: number, currency = 'USD'): string {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100)
}
