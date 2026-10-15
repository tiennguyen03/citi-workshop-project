import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import GoalProgress from './GoalProgress.jsx'

describe('GoalProgress (D27)', () => {
  it('inline: percentage of goals done with the raw counts', () => {
    render(<GoalProgress completedGoals={4} totalGoals={10} />)
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('4 / 10 goals')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '4 / 10 goals, 40%')
  })

  it('block: "complete" wording, an optional title, green at 100 %', () => {
    render(<GoalProgress layout="block" title="Project progress" completedGoals={3} totalGoals={3} />)
    expect(screen.getByText('Project progress')).toBeInTheDocument()
    expect(screen.getByText('100% complete')).toBeInTheDocument()
    expect(screen.getByText('3 of 3 goals complete')).toBeInTheDocument()
  })

  it('no goals is a neutral unconfigured state, never 0 %', () => {
    render(<GoalProgress completedGoals={0} totalGoals={0} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('No goals configured')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('0 of 10 is real work with nothing done: 0 %', () => {
    render(<GoalProgress completedGoals={0} totalGoals={10} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
