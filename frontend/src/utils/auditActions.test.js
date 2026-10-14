import { describe, expect, it } from 'vitest'
import { ACTION_LABELS, actionLabel } from './auditActions.js'

describe('actionLabel', () => {
  it('names every known action in plain words and falls back to the code', () => {
    expect(actionLabel('project.member_add')).toBe('Added a member')
    expect(actionLabel('something.new')).toBe('something.new')
    for (const label of Object.values(ACTION_LABELS)) expect(label).toMatch(/^[A-Z]/)
  })
})
