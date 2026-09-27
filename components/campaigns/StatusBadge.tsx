import { cn } from '@/lib/utils/cn'
import { STATUS_LABEL, type CampaignStatus } from '@/lib/campaigns/options'

const TONE: Record<CampaignStatus, string> = {
  DRAFT: 'bg-ink-100 text-ink-600',
  GENERATING: 'bg-brand-50 text-brand-700',
  READY: 'bg-success-surface text-success-text',
  ACTIVE: 'bg-brand-600 text-white',
  ARCHIVED: 'bg-ink-100 text-ink-500',
}

export function StatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium uppercase tracking-wide',
        TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
