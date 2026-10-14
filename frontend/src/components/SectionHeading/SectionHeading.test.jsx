import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import SectionHeading from './SectionHeading.jsx'

describe('SectionHeading', () => {
  it('renders the title as a heading with an optional aside and a decorative icon', () => {
    render(<SectionHeading icon={<HistoryOutlinedIcon />} title="Recent activity" aside={<button type="button">View all</button>} />)
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument() // icon is aria-hidden
  })
})
