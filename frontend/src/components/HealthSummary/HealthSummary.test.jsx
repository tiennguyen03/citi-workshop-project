import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HealthSummary from './HealthSummary.jsx'

describe('HealthSummary', () => {
  it('shows the state as a tag and the reasons as one sentence-case line', () => {
    render(<HealthSummary health="at_risk" reasons={['overdue_milestone', 'over_budget']} />)
    expect(screen.getByText('At risk')).toBeInTheDocument()
    expect(screen.getByText('Overdue milestone, over budget')).toBeInTheDocument()
  })

  it('can hide the tag and keep the reasons', () => {
    render(<HealthSummary health="to_close" reasons={['over_budget']} hideTag />)
    expect(screen.queryByText('Done, not archived')).not.toBeInTheDocument()
    expect(screen.getByText('Over budget')).toBeInTheDocument()
  })
})
