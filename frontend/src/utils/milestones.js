/** Open milestones first, soonest due first; completed ones after, most recently completed first. */
export function sortMilestones(items) {
  return [...items].sort((a, b) => {
    const aOpen = a.status === 'open'
    const bOpen = b.status === 'open'
    if (aOpen !== bOpen) return aOpen ? -1 : 1
    if (aOpen) return String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')) || a.name.localeCompare(b.name)
    return String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? ''))
  })
}

/** The milestone to point at as "next due": the first open one after sorting, or null. */
export function nextDueId(sorted) {
  return sorted.find((m) => m.status === 'open')?.id ?? null
}
