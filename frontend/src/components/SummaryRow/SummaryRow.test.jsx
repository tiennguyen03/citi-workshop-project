import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SummaryRow from './SummaryRow.jsx'

describe('SummaryRow', () => {
  it('emphasises the figure, mutes the label and carries a dot per tone', () => {
    render(<SummaryRow aria-label="Projects by health" items={[{ key: 'a', value: 3, label: 'At risk', tone: 'warning' }, { key: 'b', value: 2, label: 'On track', tone: 'success' }]} />)
    const row = screen.getByLabelText('Projects by health')
    expect(row).toHaveTextContent(/3\s*At risk\s*2\s*On track/)
    expect(row.querySelectorAll('span[aria-hidden]')).toHaveLength(2)
  })
})
