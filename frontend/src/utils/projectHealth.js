/**
 * Project health (decisions.md D21) as the API sends it: one word per project, worst first. Labels and tones
 * live here so the admin board and the manager cards say the same thing. The order mirrors the backend's
 * HEALTH_ORDER; the API already sorts by it, the client never re-sorts.
 */
export const HEALTH_ORDER = ['late', 'at_risk', 'needs_setup', 'to_close', 'on_track']

export const HEALTH = {
  late: { label: 'Late', tone: 'error' },
  at_risk: { label: 'At risk', tone: 'warning' },
  needs_setup: { label: 'Needs setup', tone: 'info' },
  to_close: { label: 'Done, not archived', tone: 'accent' },
  on_track: { label: 'On track', tone: 'success' },
}

/** The specific reasons behind a health word, as tags. */
export const REASON = {
  over_budget: { label: 'Over budget', tone: 'error' },
  past_end: { label: 'Past end date', tone: 'warning' },
  overdue_milestone: { label: 'Overdue milestone', tone: 'error' },
  no_members: { label: 'No members', tone: 'warning' },
  no_milestones: { label: 'No milestones', tone: 'info' },
}

export const healthLabel = (code) => HEALTH[code]?.label ?? code

/** Keys of the API's `summary.projects` object, in severity order, with the phrase used for each. */
const SUMMARY_KEYS = [
  ['late', 'late'],
  ['atRisk', 'at risk'],
  ['needsSetup', 'needing setup'],
  ['toClose', 'to close'],
  ['onTrack', 'on track'],
]

/** "1 late, 2 at risk, 1 to close, 3 on track" — buckets with nothing in them are left out. */
export function summarizeHealth(counts) {
  const parts = SUMMARY_KEYS.filter(([key]) => Number(counts?.[key]) > 0).map(([key, phrase]) => `${counts[key]} ${phrase}`)
  return parts.length ? parts.join(', ') : 'No projects yet'
}
