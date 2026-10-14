import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HealthTag from './HealthTag.jsx'

describe('HealthTag', () => {
  it('shows the label for a known code and the code itself otherwise', () => {
    render(
      <>
        <HealthTag health="at_risk" />
        <HealthTag health="something_new" />
      </>,
    )
    expect(screen.getByText('At risk')).toBeInTheDocument()
    expect(screen.getByText('something_new')).toBeInTheDocument()
  })
})
