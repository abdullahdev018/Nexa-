import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Shared heading block, so every section is set the same way. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string
  title: ReactNode
  description?: string
  align?: 'center' | 'left'
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-600">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-balance text-[30px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[40px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-pretty text-[16.5px] leading-relaxed text-ink-600 sm:text-[17.5px]">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function Section({
  id,
  children,
  className,
  muted = false,
}: {
  id?: string
  children: ReactNode
  className?: string
  muted?: boolean
}) {
  return (
    <section
      id={id}
      // Anchored sections need to clear the sticky header when jumped to.
      className={cn('scroll-mt-20 py-20 sm:py-28', muted && 'bg-ink-50', className)}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">{children}</div>
    </section>
  )
}
