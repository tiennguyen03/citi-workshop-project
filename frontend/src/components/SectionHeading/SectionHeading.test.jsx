import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SectionHeading from './SectionHeading.jsx'

describe('SectionHeading', () => {
  it('puts the description under the title and the aside on the right', () => {
    render(<SectionHeading title="Project health" description="2 at risk, 1 on track" aside={<button type="button">View all</button>} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Project health' })).toBeInTheDocument()
    expect(screen.getByText('2 at risk, 1 on track')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument()
  })
})
