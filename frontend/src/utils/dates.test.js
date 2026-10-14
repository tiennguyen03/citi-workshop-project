import { describe, expect, it } from 'vitest'
import { addDays, daysUntil, dueStatus, parseYMD, todayISO, weekRange } from './dates.js'

describe('dates', () => {
  it('formats today without a UTC shift', () => {
    expect(todayISO(new Date(2026, 9, 14, 23, 30))).toBe('2026-10-14')
    expect(todayISO(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(parseYMD('2026-10-14')).toBe(Date.UTC(2026, 9, 14))
  })

  it('counts whole days until a date', () => {
    expect(daysUntil('2026-10-21', '2026-10-14')).toBe(7)
    expect(daysUntil('2026-10-14', '2026-10-14')).toBe(0)
    expect(daysUntil('2026-10-10', '2026-10-14')).toBe(-4)
  })

  it('classifies overdue, due soon and on track', () => {
    const today = '2026-10-14'
    expect(dueStatus('2026-10-13', { today })).toEqual({ kind: 'overdue', days: -1 })
    expect(dueStatus('2026-10-14', { today })).toEqual({ kind: 'due_soon', days: 0 })
    expect(dueStatus('2026-10-21', { today })).toEqual({ kind: 'due_soon', days: 7 })
    expect(dueStatus('2026-10-22', { today })).toEqual({ kind: null, days: 8 })
    expect(dueStatus('2026-10-14', { today, soonDays: null })).toEqual({ kind: null, days: 0 })
    expect(dueStatus(null, { today })).toEqual({ kind: null, days: null })
  })

  it('finds Monday–Sunday bounds for this and last week', () => {
    expect(weekRange('this', '2026-10-14')).toEqual({ from: '2026-10-12', to: '2026-10-18' }) // a Wednesday
    expect(weekRange('this', '2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' }) // Sunday stays in its week
    expect(weekRange('this', '2026-10-12')).toEqual({ from: '2026-10-12', to: '2026-10-18' }) // Monday
    expect(weekRange('last', '2026-10-14')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
  })
})
