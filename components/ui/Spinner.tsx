import { cn } from '@/lib/utils/cn'

/** Indeterminate progress. `label` is announced; the ring itself is decorative. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <>
      <svg
        className={cn('animate-spin', className ?? 'h-4 w-4')}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  )
}
