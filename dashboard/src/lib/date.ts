/**
 * Date formatting: MM-DD-YYYY for date-only, MM-DD-YYYY h:mm A EST for datetimes.
 * Datetimes are converted to America/New_York for display.
 */

const TZ = "America/New_York"

function parseEpoch(input: string): number | null {
  // Treat pure YYYY-MM-DD as a wall-clock date (midnight EST) so it doesn't
  // shift to the previous day when the user's local zone is ahead of UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T12:00:00`).getTime()
  }
  const t = new Date(input).getTime()
  return isNaN(t) ? null : t
}

export function formatDate(input: string | null | undefined): string {
  if (!input) return "—"
  // Fast-path: if it's already YYYY-MM-DD, just rearrange
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (m) return `${m[2]}-${m[3]}-${m[1]}`
  const epoch = parseEpoch(input)
  if (epoch === null) return input
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(epoch)
  const mm = parts.find((p) => p.type === "month")?.value
  const dd = parts.find((p) => p.type === "day")?.value
  const yy = parts.find((p) => p.type === "year")?.value
  return `${mm}-${dd}-${yy}`
}

export function formatDateTime(input: string | null | undefined): string {
  if (!input) return "—"
  const epoch = parseEpoch(input)
  if (epoch === null) return input
  const date = formatDate(input)
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(epoch)
  return `${date} ${time} EST`
}

export function timeAgo(input: string | null | undefined): string {
  if (!input) return ""
  const epoch = parseEpoch(input)
  if (epoch === null) return ""
  const diff = Date.now() - epoch
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(input)
}
