import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProgressBar from './ProgressBar.jsx'

describe('ProgressBar', () => {
  it('inline layout shows the percentage and the raw figures on one line', () => {
    render(<ProgressBar layout="inline" value={53} max={1560} caption="53 h of 1,560 h" />)
    expect(screen.getByText('3%')).toBeInTheDocument()
    expect(screen.getByText('53 h of 1,560 h')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '53 h of 1,560 h, 3%')
  })

  it('stacked layout can drop its caption when the tile already says the numbers', () => {
    render(<ProgressBar value={140} max={4600} caption="140 h of 4,600 h" showCaption={false} />)
    expect(screen.queryByText('140 h of 4,600 h')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
