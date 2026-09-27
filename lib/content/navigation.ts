import {
  BarChart3,
  Binoculars,
  CalendarDays,
  CreditCard,
  Clapperboard,
  FileText,
  LayoutDashboard,
  Megaphone,
  Palette,
  Settings,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { PlanLimits } from '@/lib/billing/plans'

/**
 * The product navigation. One list, so the sidebar, the mobile drawer and the
 * dashboard's quick actions can never drift out of step with each other.
 */
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** One line, used as the tooltip and on the section's own page. */
  description: string
  /**
   * The plan capability this section needs. The item is always visible — a
   * person should be able to see what the product does — but it is marked as
   * locked when their plan does not include it.
   */
  requires?: keyof PlanLimits
  /** True once the section is genuinely built. Unbuilt sections say so. */
  built: boolean
}

export interface NavGroup {
  /** Null renders the group without a heading. */
  label: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Everything happening across your marketing, at a glance.',
        built: true,
      },
    ],
  },
  {
    label: 'Create',
    items: [
      {
        label: 'Campaigns',
        href: '/campaigns',
        icon: Megaphone,
        description: 'Turn one product brief into a complete marketing campaign.',
        requires: 'campaignBuilder',
        built: true,
      },
      {
        label: 'Content Studio',
        href: '/content',
        icon: FileText,
        description: 'Posts, reels, stories, carousels and captions, per platform.',
        built: true,
      },
      {
        label: 'AI Video',
        href: '/video',
        icon: Clapperboard,
        description: 'Hooks, scripts, scenes and shot direction for video.',
        requires: 'videoGeneration',
        built: true,
      },
      {
        label: 'Ad Studio',
        href: '/ads',
        icon: Target,
        description: 'Primary text, headlines and variations for Meta, Google and TikTok.',
        built: true,
      },
    ],
  },
  {
    label: 'Plan',
    items: [
      {
        label: 'Brand Kit',
        href: '/brand',
        icon: Palette,
        description: 'The voice, colours and audience every generation writes in.',
        // No `requires`: every plan can save a brand's identity. Only the kit
        // fields are Starter and up, and the page itself marks those.
        built: true,
      },
      {
        label: 'Marketing Calendar',
        href: '/calendar',
        icon: CalendarDays,
        description: 'What goes out, where, and when.',
        requires: 'contentCalendar',
        built: true,
      },
    ],
  },
  {
    label: 'Measure',
    items: [
      {
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
        description: 'Reach, clicks, leads and spend — from results you import.',
        requires: 'analytics',
        built: true,
      },
      {
        label: 'Competitor Research',
        href: '/research',
        icon: Binoculars,
        description: 'What a competitor says, and where the gaps are.',
        requires: 'competitorResearch',
        built: false,
      },
    ],
  },
  {
    label: null,
    items: [
      {
        label: 'AI Assistant',
        href: '/chat',
        icon: Sparkles,
        description: 'Ask Nexa anything about your marketing.',
        built: true,
      },
      {
        label: 'Billing & credits',
        href: '/billing',
        icon: CreditCard,
        description: 'Your plan, credits left, and where they went.',
        built: true,
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        description: 'How Nexa behaves for you.',
        built: true,
      },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

/** The item whose section the given path belongs to, for highlighting. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0]
}

export function navItem(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href)
}
