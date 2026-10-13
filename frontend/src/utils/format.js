const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  return money.format(Number(value))
}

export function formatDateTime(iso) {
  return iso ? dateTime.format(new Date(iso)) : '—'
}

/** Formats a YYYY-MM-DD string without timezone shifting. */
export function formatDate(ymd) {
  if (!ymd) return '—'
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  return date.format(new Date(y, m - 1, d))
}

export function formatHours(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} h`
}

/** Time-of-day greeting for the dashboard. */
export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
