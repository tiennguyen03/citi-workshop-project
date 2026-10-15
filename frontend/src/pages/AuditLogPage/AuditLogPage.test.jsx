import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import * as auditApi from '../../services/auditLog.js'
import * as usersApi from '../../services/users.js'
import AuditLogPage from './AuditLogPage.jsx'

vi.mock('../../services/auditLog.js')
vi.mock('../../services/users.js')

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
const PEOPLE = [
  { id: 'ADM001', firstName: 'Ada', lastName: 'Admin', role: 'admin' },
  { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', role: 'employee' },
]

function Url() {
  const { search } = useLocation()
  return <p>url {search}</p>
}

function renderPage(url = '/audit-log') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/audit-log"
          element={
            <>
              <AuditLogPage />
              <Url />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    auditApi.actions.mockResolvedValue({ items: ['auth.login', 'project.archive', 'user.create'] })
    usersApi.list.mockResolvedValue({ items: PEOPLE, total: 2 })
  })

  it('renders entries with actor, action and expandable details', async () => {
    auditApi.list.mockResolvedValue({ items: [ENTRY], total: 1 })
    renderPage()
    expect(await screen.findByText("Created employee 'eve'")).toBeInTheDocument()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('user.create')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /show details/i }))
    expect(screen.getByText(/"username": "eve"/)).toBeInTheDocument()
  })

  it('pages with the footer and applies action + actor filters into the URL', async () => {
    const user = userEvent.setup()
    auditApi.list.mockResolvedValue({ items: [ENTRY], total: 60 })
    renderPage()
    expect(await screen.findByText('1–10 of 60')).toBeInTheDocument()
    auditApi.list.mockResolvedValue({ items: [{ ...ENTRY, id: 2, summary: 'second page' }], total: 60 })
    await user.click(screen.getByRole('button', { name: /next page/i }))
    expect(await screen.findByText('second page')).toBeInTheDocument()
    expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 10, limit: 10 }))
    expect(screen.getByText('url ?page=2')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: /action/i }))
    await user.click(await screen.findByRole('option', { name: /project\.archive/ }))
    await user.click(screen.getByRole('combobox', { name: /actor/i }))
    await user.click(await screen.findByRole('option', { name: 'Eve Employee' }))
    await user.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'project.archive', actorId: 'EMP001', offset: 0 })),
    )
    expect(screen.getByText('url ?action=project.archive&actorId=EMP001')).toBeInTheDocument() // filtering resets to page 1
    await user.click(screen.getByRole('button', { name: /clear/i }))
    await waitFor(() => expect(screen.getByText('url')).toBeInTheDocument())
    expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ action: '', actorId: '', offset: 0 }))
  })

  it('reads the actor from the URL, as linked from a user page', async () => {
    auditApi.list.mockResolvedValue({ items: [], total: 0 })
    renderPage('/audit-log?actorId=EMP001')
    expect(await screen.findByText('No actions match these filters.')).toBeInTheDocument()
    expect(auditApi.list).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'EMP001' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: /actor/i })).toHaveTextContent('Eve Employee'))
  })

  it('shows the error state', async () => {
    auditApi.list.mockRejectedValue(new Error('Could not reach the server'))
    renderPage()
    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })
})
