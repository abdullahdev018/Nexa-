import { cn } from '@/lib/utils/cn'

/**
 * The one label for anything announced but not built yet, so the sidebar,
 * the plan cards and the pricing table all say it the same way.
 */
export function ComingSoon({ size = 'sm', className }: { size?: 'xs' | 'sm'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-100 to-pink-100 font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-300/60 dark:from-amber-400/15 dark:to-pink-400/15 dark:text-amber-300 dark:ring-amber-400/30',
        size === 'xs' ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-0.5 text-[10.5px]',
        className,
      )}
    >
      <span aria-hidden="true">🚀</span>
      Coming soon!
    </span>
  )
}
