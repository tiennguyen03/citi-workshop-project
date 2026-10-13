import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as auditApi from '../../services/auditLog.js'
import AuditLogPage from './AuditLogPage.jsx'

vi.mock('../../services/auditLog.js')

const ENTRY = {
  id: 1,
  occurredAt: '2026-10-14T12:00:00Z',
  actor: { id: 'ADM001', firstName: 'Ada', lastName: 'Admin', role: 'admin' },
  actorRole: 'admin',
  action: 'user.create',
  entityType: 'user',
  entityId: 'EMP001',
  summary: "Created employee 'eve'",
  details: { username: 'eve' },
  statusCode: 201,
}

describe('AuditLogPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders entries with actor, action and expandable details', async () => {
    auditApi.list.mockResolvedValue({ items: [ENTRY], total: 1 })
    render(<AuditLogPage />)
    expect(await screen.findByText("Created employee 'eve'")).toBeInTheDocument()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('user.create')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /show details/i }))
    expect(screen.getByText(/"username": "eve"/)).toBeInTheDocument()
  })

  it('loads the next page and applies filters', async () => {
    const user = userEvent.setup()
    auditApi.list.mockResolvedValue({ items: [ENTRY], total: 60 })
    render(<AuditLogPage />)
    const more = await screen.findByRole('button', { name: /load more/i })
    auditApi.list.mockResolvedValue({ items: [{ ...ENTRY, id: 2, summary: 'second page' }], total: 60 })
    await user.click(more)
    expect(await screen.findByText('second page')).toBeInTheDocument()
    expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50, limit: 50 }))

    await user.type(screen.getByLabelText(/action/i, { selector: 'input' }), 'project.archive')
    await user.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'project.archive', offset: 0 })),
    )
  })
})
