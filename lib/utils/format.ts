/** Date and text helpers shared by the sidebar, history and account pages. */

export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "just now", "12m ago", "3h ago", then a date. */
export function formatRelative(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`
  return formatDate(date)
}

export type DateGroup = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Previous 30 days' | 'Older'

/** Which sidebar heading a conversation belongs under. */
export function groupForDate(value: Date | string): DateGroup {
  const date = typeof value === 'string' ? new Date(value) : value

  // Compared at day granularity in local time, so a message at 00:00 today is
  // "Today" rather than falling into the previous bucket.
  const startOfDay = (input: Date) => {
    const copy = new Date(input)
    copy.setHours(0, 0, 0, 0)
    return copy.getTime()
  }

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  if (days < 30) return 'Previous 30 days'
  return 'Older'
}

export const DATE_GROUP_ORDER: DateGroup[] = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Previous 30 days',
  'Older',
]
