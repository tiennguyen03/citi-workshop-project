import { describe, expect, it } from 'vitest'
import { nextDueId, sortMilestones } from './milestones.js'

const ms = (id, status, dueDate, completedAt = null, name = id) => ({ id, status, dueDate, completedAt, name })

describe('sortMilestones', () => {
  it('puts open milestones first by due date, then completed by most recent', () => {
    const sorted = sortMilestones([
      ms('done-old', 'complete', '2026-09-01', '2026-09-02T10:00:00Z'),
      ms('open-late', 'open', '2026-11-20'),
      ms('done-new', 'complete', '2026-09-10', '2026-09-12T10:00:00Z'),
      ms('open-soon', 'open', '2026-10-16'),
    ])
    expect(sorted.map((m) => m.id)).toEqual(['open-soon', 'open-late', 'done-new', 'done-old'])
    expect(nextDueId(sorted)).toBe('open-soon')
  })

  it('does not mutate the input and returns null when nothing is open', () => {
    const input = [ms('a', 'complete', '2026-09-01', '2026-09-02T10:00:00Z')]
    const sorted = sortMilestones(input)
    expect(sorted).not.toBe(input)
    expect(nextDueId(sorted)).toBeNull()
  })
})
