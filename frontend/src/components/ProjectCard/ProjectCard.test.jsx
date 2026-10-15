import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProjectCard from './ProjectCard.jsx'

const BASE = {
  id: 'PRJ001',
  name: 'Customer Portal Redesign',
  status: 'active',
  startDate: '2026-09-14',
  endDate: '2026-12-11',
  memberCount: 3,
  hoursCompleted: 53,
  capacityHours: 1560,
  budgetRemaining: 317179,
  milestoneCounts: { open: 2, complete: 1 },
  nextDueDate: '2020-01-01',
}
const renderCard = (project) => render(<MemoryRouter><ProjectCard project={project} /></MemoryRouter>)

describe('ProjectCard (D25)', () => {
  it('leads with health and the reason, not the lifecycle status, and keeps progress as one unit', () => {
    renderCard({ ...BASE, health: 'at_risk', reasons: ['overdue_milestone'] })
    expect(screen.getByText('At risk')).toBeInTheDocument()
    expect(screen.getByText('Overdue milestone')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.getByText('3% complete')).toBeInTheDocument()
    expect(screen.getByText('53 h / 1,560 h')).toBeInTheDocument()
    expect(screen.getByText('$317,179')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '2 open milestones' })).toHaveTextContent('2 open')
    expect(screen.getByText('1 complete')).toBeInTheDocument()
    expect(screen.getByText('Overdue').querySelector('.Tag-dot')).not.toBeNull() // supporting text, not a second pill
  })

  it('shows Complete in the health slot for a finished project and no due cue', () => {
    renderCard({ ...BASE, status: 'complete', health: 'to_close', reasons: [], nextDueDate: null })
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.queryByText('Done, not archived')).not.toBeInTheDocument()
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
