import { cn } from '@/lib/utils/cn'

export type ContentStatus = 'DRAFT' | 'READY' | 'SCHEDULED' | 'PUBLISHED'

const STYLE: Record<ContentStatus, { label: string; tone: string }> = {
  DRAFT: { label: 'Draft', tone: 'bg-ink-100 text-ink-600' },
  READY: { label: 'Ready', tone: 'bg-success-surface text-success-text' },
  // "Planned", not "Scheduled": it is on the user's calendar, and Nexa posts nothing.
  SCHEDULED: { label: 'Planned', tone: 'bg-brand-50 text-brand-700' },
  PUBLISHED: { label: 'Published', tone: 'bg-brand-600 text-white' },
}

export function ContentStatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium uppercase tracking-wide',
        STYLE[status].tone,
        className,
      )}
    >
      {STYLE[status].label}
    </span>
  )
}
