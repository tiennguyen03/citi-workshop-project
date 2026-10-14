import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TitleCell from './TitleCell.jsx'

describe('TitleCell', () => {
  it('renders the title as a link with a muted caption and an adornment', () => {
    render(
      <MemoryRouter>
        <TitleCell title="Customer Portal" to="/projects/1" caption="Marcus Bell" adornment={<span>Next due</span>} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Customer Portal' })).toHaveAttribute('href', '/projects/1')
    expect(screen.getByText('Marcus Bell')).toBeInTheDocument()
    expect(screen.getByText('Next due')).toBeInTheDocument()
  })
})
