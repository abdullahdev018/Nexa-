/**
 * All marketing copy in one file, so wording changes never mean touching JSX.
 *
 * Every claim here describes something the product actually does. There are no
 * invented customers, logos, testimonials or metrics anywhere on the site.
 */

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
}

export const FEATURES: Feature[] = [
  {
    icon: 'MessagesSquare',
    title: 'Smart conversations',
    description:
      'Nexa keeps the whole thread in view, so follow-up questions land in context instead of starting from nothing. Ask it to change tack mid-conversation and it follows.',
  },
  {
    icon: 'Zap',
    title: 'Fast responses',
    description:
      'Answers stream in as they are written, so you read the first line while the rest is still arriving. Pick a faster model when you want speed over depth.',
  },
  {
    icon: 'FileSearch',
    title: 'File analysis',
    description:
      'Attach code, CSVs, JSON, markdown or an image and ask about it directly. Nexa reads the file as part of the question rather than making you paste it in.',
  },
  {
    icon: 'History',
    title: 'Conversation history',
    description:
      'Every chat is saved to your account, grouped by day, and searchable by title or by anything said inside it. Pin the ones you keep coming back to.',
  },
  {
    icon: 'Code2',
    title: 'Coding help',
    description:
      'Syntax-highlighted code blocks with one-click copy, whole-file rewrites, and explanations that match the language you are actually working in.',
  },
  {
    icon: 'PenLine',
    title: 'Writing assistance',
    description:
      'Drafts, edits, rewrites and tone changes. Set standing instructions once and Nexa writes the way you want without being told each time.',
  },
]

export interface Step {
  title: string
  description: string
}

export const STEPS: Step[] = [
  {
    title: 'Create your account',
    description:
      'Email and a password is all it takes. No credit card, and no sales call before you can try it.',
  },
  {
    title: 'Tell Nexa what you do',
    description:
      'A two-minute setup captures your role and what you want help with, and Nexa uses it to pitch every answer correctly from the first message.',
  },
  {
    title: 'Start working',
    description:
      'Ask a question, attach a file, or paste in what you are stuck on. Every conversation is saved, searchable and yours to delete.',
  },
]

export interface PricingTier {
  id: string
  name: string
  price: string
  cadence: string
  description: string
  features: string[]
  cta: string
  href: string
  featured?: boolean
}

export const PRICING: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Everything you need to use Nexa for everyday work.',
    features: [
      'Nexa Swift and Nexa Balanced models',
      'Unlimited saved conversations',
      'Full-text search across your history',
      'File and image attachments',
      'Custom instructions',
    ],
    cta: 'Get started',
    href: '/signup',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    cadence: 'per month',
    description: 'For longer, harder work that needs the most capable model.',
    features: [
      'Everything in Free',
      'Nexa Deep — the most capable model',
      'Higher message limits',
      'Longer context for large files',
      'Priority access when demand is high',
    ],
    // Self-service checkout does not exist yet, so this cannot claim to take
    // a payment. It creates the account we would upgrade.
    cta: 'Create your account',
    href: '/signup',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 'Custom',
    cadence: 'talk to us',
    description: 'Shared billing and central administration for a whole team.',
    features: [
      'Everything in Pro',
      'Centralised billing',
      'Shared workspace administration',
      'Onboarding support',
    ],
    cta: 'Create your account',
    href: '/signup',
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ: FaqItem[] = [
  {
    question: 'What can I actually use Nexa for?',
    answer:
      'Everyday knowledge work: drafting and editing writing, explaining or debugging code, working through a problem out loud, summarising a document you attach, and answering questions. It is a general assistant rather than a single-purpose tool.',
  },
  {
    question: 'Is my conversation history private?',
    answer:
      'Your conversations are stored against your account so they are there when you come back, and they are visible only to you. You can delete any conversation, or your entire account with everything in it, from Settings at any time.',
  },
  {
    question: 'Do you train models on my chats?',
    answer:
      'No. Your messages are sent to the model provider to generate a reply and stored in your own history. They are not used to train models.',
  },
  {
    question: 'What files can I attach?',
    answer:
      'Text-based files — code, CSV, JSON, markdown, plain text — are read directly, and JPEG, PNG, GIF and WebP images can be analysed visually. Attachments are capped at 5 MB each, five per message.',
  },
  {
    question: 'What is the difference between the models?',
    answer:
      'Nexa Swift is the fastest and best for quick questions. Nexa Balanced is the default and handles most work well. Nexa Deep thinks longer and is aimed at analysis, long documents and hard code; it is included with Pro.',
  },
  {
    question: 'Can I cancel Pro?',
    answer:
      'Yes, at any time, and you keep Pro until the end of the period you have paid for. Your conversations stay exactly where they are on the Free plan.',
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

/** The scripted exchange in the hero preview. */
export const PREVIEW_TURNS = [
  {
    role: 'user' as const,
    text: 'Summarise this quarterly report and pull out the three numbers that matter.',
  },
  {
    role: 'assistant' as const,
    text: "Revenue grew 18% to $4.2M, but it's the other two figures that explain the quarter:\n\n**Net retention: 112%** — existing customers are expanding faster than new ones arrive.\n**Gross margin: 74%**, up 6 points, almost entirely from the infrastructure migration.\n\nThe risk is concentration: the top three accounts are now 31% of revenue.",
  },
]
