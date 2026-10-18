const MINUTE = 60_000
const HOUR = 60 * MINUTE

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

// "just now", "5 minutes ago", "3 hours ago", "Yesterday", "4 days ago", then a date.
export function relativeTime(iso: string, now: Date = new Date(), locale?: string): string {
  const date = new Date(iso)
  const time = date.getTime()
  if (Number.isNaN(time)) return ''

  const elapsed = now.getTime() - time
  // Future timestamps (clock skew) read as "just now".
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'minute')

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (time >= startOfToday) return plural(Math.floor(elapsed / HOUR), 'hour')

  const days = Math.round(
    (startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      (24 * HOUR),
  )
  if (days <= 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}
