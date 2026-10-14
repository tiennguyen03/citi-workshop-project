import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tag from './Tag.jsx'
import RoleChip from '../RoleChip/RoleChip.jsx'
import StatusChip from '../StatusChip/StatusChip.jsx'

describe('Tag weights (D24)', () => {
  it('a quiet tag always carries its dot; a tinted one only when asked', () => {
    render(
      <>
        <Tag label="Active" tone="info" variant="quiet" />
        <Tag label="Overdue" tone="error" />
      </>,
    )
    expect(screen.getByText('Active').querySelector('.Tag-dot')).not.toBeNull()
    expect(screen.getByText('Overdue').querySelector('.Tag-dot')).toBeNull()
  })

  it('roles are quiet by default and statuses only tint the final state', () => {
    render(
      <>
        <RoleChip role="manager" />
        <StatusChip status="active" />
        <StatusChip status="complete" />
        <StatusChip status="active" archived />
      </>,
    )
    expect(screen.getByText('Manager').querySelector('.Tag-dot')).not.toBeNull()
    expect(screen.getAllByText('Active')).toHaveLength(2) // live and archived, both quiet
    expect(screen.getByText('Complete').querySelector('.Tag-dot')).not.toBeNull()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })
})
