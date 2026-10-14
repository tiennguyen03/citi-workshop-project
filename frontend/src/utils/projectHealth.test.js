import { describe, expect, it } from 'vitest'
import { HEALTH, HEALTH_ORDER, REASON, healthLabel, summarizeHealth } from './projectHealth.js'

describe('projectHealth', () => {
  it('names every health code and falls back to the code', () => {
    for (const code of HEALTH_ORDER) expect(HEALTH[code].label).toMatch(/^[A-Z]/)
    expect(healthLabel('to_close')).toBe('Done, not archived')
    expect(healthLabel('mystery')).toBe('mystery')
    expect(Object.keys(REASON)).toHaveLength(5)
  })

  it('summarises counts worst first, skipping empty buckets', () => {
    expect(summarizeHealth({ late: 1, atRisk: 2, needsSetup: 0, toClose: 1, onTrack: 3 })).toBe('1 late, 2 at risk, 1 to close, 3 on track')
    expect(summarizeHealth({ late: 0, atRisk: 0, needsSetup: 0, toClose: 0, onTrack: 0 })).toBe('No projects yet')
  })
})
