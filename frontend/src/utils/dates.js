/**
 * Calendar-date helpers. Every value is a YYYY-MM-DD string and all arithmetic goes through
 * Date.UTC, so nothing shifts by a day across time zones (decisions.md D18, D19).
 */

const DAY_MS = 86_400_000

/** Today as YYYY-MM-DD in the browser's local time zone (no UTC shift). */
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** YYYY-MM-DD → milliseconds at UTC midnight. */
export function parseYMD(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/** `ymd` shifted by `n` calendar days (negative moves back). */
export function addDays(ymd, n) {
  return fromUTC(parseYMD(ymd) + n * DAY_MS)
}

/** Whole days from `today` to `ymd`: negative when `ymd` is in the past, 0 when it is today. */
export function daysUntil(ymd, today = todayISO()) {
  return Math.round((parseYMD(ymd) - parseYMD(today)) / DAY_MS)
}

/**
 * How urgent a due date is. `soonDays` is the amber window (inclusive); pass `null` to
 * report only overdue.
 * @returns {{ kind: 'overdue'|'due_soon'|null, days: number|null }}
 */
export function dueStatus(dueDate, { today = todayISO(), soonDays = 7 } = {}) {
  if (!dueDate) return { kind: null, days: null }
  const days = daysUntil(dueDate, today)
  if (days < 0) return { kind: 'overdue', days }
  if (soonDays !== null && days <= soonDays) return { kind: 'due_soon', days }
  return { kind: null, days }
}

/** Monday–Sunday bounds of `this` or `last` week (same convention as the API's `week`). */
export function weekRange(which, today = todayISO()) {
  const weekday = (new Date(parseYMD(today)).getUTCDay() + 6) % 7 // Monday = 0
  const monday = addDays(today, -weekday - (which === 'last' ? 7 : 0))
  return { from: monday, to: addDays(monday, 6) }
}
