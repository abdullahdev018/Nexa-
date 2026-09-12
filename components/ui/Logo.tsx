import Link from 'next/link'
import { useId } from 'react'
import { cn } from '@/lib/utils/cn'

interface LogoProps {
  /** Pixel size of the square mark. */
  size?: number
  /** Render the "Nexa AI" wordmark beside the mark. */
  withWordmark?: boolean
  /** Wrap in a link to the marketing home page. */
  href?: string | null
  className?: string
}

/**
 * The Nexa mark: an N traced as a circuit run, blue climbing from the
 * lower-left node and silver descending to the upper-right one, on the deep
 * navy tile the brand's palette is drawn from.
 *
 * Inlined rather than loaded as an image so it never flashes as a missing
 * asset and inherits nothing from the page. The gradient ids are generated per
 * instance — several logos render on one page, and duplicate ids would make
 * every mark reuse the first one's gradients.
 */
export function Logo({ size = 32, withWordmark = false, href = '/', className }: LogoProps) {
  const uid = useId().replace(/:/g, '')
  const blue = `nexa-blue-${uid}`
  const silver = `nexa-silver-${uid}`

  const mark = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id={blue} x1="14" y1="50" x2="36" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0b74e0" />
            <stop offset="1" stopColor="#4cbcff" />
          </linearGradient>
          <linearGradient id={silver} x1="48" y1="14" x2="30" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f4f7fc" />
            <stop offset="1" stopColor="#8e9fb8" />
          </linearGradient>
        </defs>

        <rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#0b1220" />
        <rect
          x="1.5"
          y="1.5"
          width="61"
          height="61"
          rx="16"
          fill="none"
          stroke="#33445e"
          strokeWidth="1.5"
        />

        <g fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 46 L20 18 L32 32" stroke={`url(#${blue})`} />
          <path d="M32 32 L44 46 L44 18" stroke={`url(#${silver})`} />
        </g>

        <circle cx="20" cy="46" r="6.5" fill="#2a9bf5" />
        <circle cx="20" cy="46" r="2.6" fill="#0b1220" />
        <circle cx="44" cy="18" r="6.5" fill="#e6ecf5" />
        <circle cx="44" cy="18" r="2.6" fill="#0b1220" />
      </svg>

      {withWordmark && (
        <span
          className="font-semibold tracking-tight text-ink-900"
          style={{ fontSize: size * 0.58 }}
        >
          Nexa<span className="text-brand-600"> AI</span>
        </span>
      )}
    </span>
  )

  if (!href) return mark

  return (
    <Link href={href} className="inline-flex rounded-md" aria-label="Nexa AI — home">
      {mark}
    </Link>
  )
}
