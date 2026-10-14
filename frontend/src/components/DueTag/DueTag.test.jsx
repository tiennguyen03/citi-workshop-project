import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DueTag from './DueTag.jsx'
import { addDays, todayISO } from '../../utils/dates.js'

const today = todayISO()

describe('DueTag', () => {
  it('shows Overdue for a past date', () => {
    render(<DueTag dueDate={addDays(today, -1)} />)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('counts down inside the amber window', () => {
    const { rerender } = render(<DueTag dueDate={today} />)
    expect(screen.getByText('Due today')).toBeInTheDocument()
    rerender(<DueTag dueDate={addDays(today, 1)} />)
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument()
    rerender(<DueTag dueDate={addDays(today, 5)} />)
    expect(screen.getByText('Due in 5 days')).toBeInTheDocument()
  })

  it('renders nothing when on track, closed, or the amber window is off', () => {
    const { container, rerender } = render(<DueTag dueDate={addDays(today, 30)} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<DueTag dueDate={addDays(today, -3)} isOpen={false} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<DueTag dueDate={addDays(today, 2)} soonDays={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('takes a custom overdue label and tone', () => {
    render(<DueTag dueDate={addDays(today, -3)} overdueLabel="Past end date" overdueTone="warning" soonDays={null} />)
    expect(screen.getByText('Past end date')).toBeInTheDocument()
  })
})
