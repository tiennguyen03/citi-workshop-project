import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SummaryRow from './SummaryRow.jsx'

describe('SummaryRow', () => {
  it('emphasises the figure, mutes the label and carries a dot per tone', () => {
    render(<SummaryRow variant="tally" aria-label="Projects by health" items={[{ key: 'a', value: 3, label: 'At risk', tone: 'warning' }, { key: 'b', value: 2, label: 'On track', tone: 'success' }]} />)
    const row = screen.getByLabelText('Projects by health')
    expect(row).toHaveTextContent(/At risk\s*3\s*On track\s*2/) // a tally reads category then count
    expect(row.querySelectorAll('span[aria-hidden]')).toHaveLength(2)
  })
})

describe('SummaryRow measure', () => {
  it('reads the figure first for a measurement', () => {
    render(<SummaryRow aria-label="Team hours" items={[{ key: 'h', value: '24 h', label: 'logged this week', tone: 'success' }]} />)
    expect(screen.getByLabelText('Team hours')).toHaveTextContent(/24 h\s*logged this week/)
  })
})
