/**
 * All marketing copy in one file, so wording changes never mean touching JSX.
 *
 * Every claim here describes something the product actually does today. There
 * are no invented customers, logos, testimonials or metrics anywhere on the
 * site, and nothing that implies Nexa posts, launches, renders or spends on
 * the user's behalf — it does none of those. Prices and plan contents are not
 * written here at all: they are read from `lib/billing/plans.ts`, the same
 * config the product enforces, so the site cannot drift from what is sold.
 */

import type { PlanLimits } from '@/lib/billing/plans'

export const TAGLINE = 'Your AI Marketing Team'
export const PROMISE = 'Give Nexa your product. Nexa builds your marketing campaign.'

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
] as const

export interface Feature {
  /** Lucide icon name, resolved in the component. */
  icon: string
  title: string
  description: string
  /** The plan capability it needs; the component names the cheapest plan with it. */
  requires?: keyof PlanLimits
}

export const FEATURES: Feature[] = [
  {
    icon: 'Megaphone',
    title: 'Campaign Generator',
    description:
      'Pick a product, a goal, an audience, your platforms and a style. Nexa writes the strategy, positioning, hooks, content ideas, video concepts, ad copy, captions, calls to action and a 14-day calendar.',
  },
  {
    icon: 'Palette',
    title: 'Brand Kit',
    description:
      'Save your voice, audience, colours, fonts, guidelines and products once. Every campaign, post and ad is written from it, so everything sounds like you.',
  },
  {
    icon: 'FileText',
    title: 'Content Studio',
    description:
      'Posts, reels, shorts, stories, carousels and captions — written for the platform they are going on, up to three variations at a time.',
  },
  {
    icon: 'Clapperboard',
    title: 'AI video plans',
    requires: 'videoGeneration',
    description:
      'A shootable plan for a phone: the hook, timed scenes, shots, on-screen text, voiceover and a shot list. Nexa writes the plan; it does not render video.',
  },
  {
    icon: 'Target',
    title: 'Ad Studio',
    description:
      'Primary text, headlines and descriptions for Meta, Google and TikTok, checked against each platform’s character limits, with a CSV to take into your ad manager.',
  },
  {
    icon: 'CalendarDays',
    title: 'Marketing calendar',
    requires: 'contentCalendar',
    description:
      'Put a campaign on real dates, plan weeks of posts with AI, or add pieces one by one. It is your plan — Nexa does not post for you.',
  },
  {
    icon: 'BarChart3',
    title: 'Analytics & Insights',
    requires: 'analytics',
    description:
      'Import results from your ad manager to see reach, clicks, leads and spend in one place, then ask Nexa what the numbers mean and what to do next.',
  },
  {
    icon: 'Sparkles',
    title: 'AI Assistant',
    description:
      'Ask anything about your marketing. The assistant knows your brand and products, so answers start from your business, not from scratch.',
  },
]

export interface Step {
  title: string
  description: string
}

export const STEPS: Step[] = [
  {
    title: 'Set up your brand',
    description:
      'Tell Nexa who you are, who you sell to and how you sound. It takes a few minutes and every piece of work reads from it.',
  },
  {
    title: 'Give Nexa your product',
    description:
      'Pick a product, what the campaign should achieve, who it is for and where you sell. That is the whole brief.',
  },
  {
    title: 'Get the campaign — then build on it',
    description:
      'Strategy, hooks, content, video plans, ad copy and a calendar in one place. Turn any idea into finished posts, videos or ads with one click.',
  },
]

/**
 * What Nexa does not do, said plainly. These are the lines a marketing tool is
 * most tempted to blur, so the site says them out loud.
 */
export const HONESTY: { title: string; description: string }[] = [
  {
    title: 'It does not post for you',
    description: 'Nexa is not connected to your social accounts. You publish what it writes, when you choose.',
  },
  {
    title: 'It does not spend your money',
    description: 'Ads are written, never launched. No ad account is connected, and nothing is bought on your behalf.',
  },
  {
    title: 'It does not fake results',
    description: 'Analytics shows numbers you import. Sample data lives in a separate, clearly labelled demo view.',
  },
  {
    title: 'It charges only for what worked',
    description: 'Credits are taken when a generation succeeds. A failed one is logged and costs nothing.',
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ: FaqItem[] = [
  {
    question: 'Who is Nexa for?',
    answer:
      'Solo marketers, small businesses, online shops, creators and small agencies — anyone who has a product to sell and not enough hours to plan, write and schedule everything around it.',
  },
  {
    question: 'Does Nexa post to Instagram or TikTok for me?',
    answer:
      'No. Nexa is not connected to any social or ad account. It writes the posts, video plans and ads, puts them on your calendar, and you publish them. It will never say something was posted when it was not.',
  },
  {
    question: 'Does it make videos?',
    answer:
      'It writes the video plan — hook, scenes, shots, on-screen text and voiceover — for you or a creator to film. It does not render video files; no video provider is connected, and the app says so on every plan.',
  },
  {
    question: 'How do credits work?',
    answer:
      'Each plan comes with credits every month, and each kind of generation costs a set number — a whole campaign costs more than a caption. Credits are charged only when a generation succeeds, and you can see every one in your credit history. Unused credits do not roll over.',
  },
  {
    question: 'Can I buy a paid plan today?',
    answer:
      'Not yet. Online checkout is not open, so every account starts on Free. The prices below are what the plans will cost when it opens.',
  },
  {
    question: 'Is my data private? Do you train on it?',
    answer:
      'Your brand, campaigns and content are stored in your workspace and visible only to its members. What you send is passed to the AI provider to generate a reply and is not used to train models. You can delete your account and everything in it at any time.',
  },
]

export const FOOTER_LINKS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Create an account', href: '/signup' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
] as const

/**
 * The example shown in the hero. It is labelled on the page as an example of
 * the kind of output Nexa writes — not a customer, and not a result.
 */
export const EXAMPLE_CAMPAIGN = {
  brief: {
    product: 'Fig & Cedar soy candle',
    goal: 'Product launch',
    platforms: 'Instagram · TikTok',
    style: 'Warm, premium',
  },
  angle: 'Scent as a ritual — the ten quiet minutes at the end of the day.',
  hooks: [
    'Your living room, but on holiday.',
    'We pour every one by hand. Here is why that matters.',
    'The candle that made our studio smell like a Greek summer.',
  ],
  pieces: [
    { label: 'Content ideas', count: 8 },
    { label: 'Video concepts', count: 3 },
    { label: 'Ad variations', count: 3 },
    { label: 'Calendar slots', count: 14 },
  ],
}
