import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as usersApi from '../../services/users.js'
import UserDetailPage from './UserDetailPage.jsx'

vi.mock('../../services/users.js')

const MANAGER = { id: 'MGR001', firstName: 'Mia', lastName: 'Manager' }
const HISTORY = [
  { id: 'PRJ001', name: 'Decommission', status: 'active', archived: false, hoursAssigned: 120, hoursCompleted: 30, isActive: true, releasedReason: null, addedAt: '2026-10-05T09:00:00Z', releasedAt: null },
  { id: 'PRJ000', name: 'Old portal', status: 'complete', archived: false, hoursAssigned: 80, hoursCompleted: 80, isActive: false, releasedReason: 'completed', addedAt: '2026-06-01T09:00:00Z', releasedAt: '2026-09-30T17:00:00Z' },
]
const EVE = {
  id: 'EMP001',
  username: 'eve.e',
  firstName: 'Eve',
  lastName: 'Employee',
  email: 'eve@x.com',
  jobTitle: 'Engineer',
  role: 'employee',
  managerId: 'MGR001',
  isActive: true,
  currentProject: { id: 'PRJ001', name: 'Decommission' },
  manager: MANAGER,
  projects: HISTORY,
}

function WhereAmI() {
  const { pathname, search } = useLocation()
  return <p>at {pathname + search}</p>
}

function renderPage(me, url = '/users/EMP001') {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user: me, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/users/:id" element={<UserDetailPage />} />
          <Route path="/projects/:id" element={<WhereAmI />} />
          <Route path="/audit-log" element={<WhereAmI />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    usersApi.list.mockResolvedValue({ items: [], total: 0 })
  })

  it('shows who the person reports to and their project history, opening a project on click', async () => {
    const user = userEvent.setup()
    usersApi.get.mockResolvedValue(EVE)
    renderPage({ id: 'MGR001', role: 'manager' })
    expect(await screen.findByRole('heading', { name: 'Eve Employee' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mia Manager' })).toHaveAttribute('href', '/users/MGR001')
    expect(screen.getByText('Old portal')).toBeInTheDocument()
    expect(screen.getByText('Released (completed)')).toBeInTheDocument()
    expect(screen.getByText('30 / 120 h')).toBeInTheDocument()
    expect(screen.getByText('Sep 30, 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View activity' })).not.toBeInTheDocument()
    await user.click(screen.getByText('Old portal'))
    expect(await screen.findByText('at /projects/PRJ000')).toBeInTheDocument()
  })

  it('lets an admin jump to the audit log filtered to this person', async () => {
    const user = userEvent.setup()
    usersApi.get.mockResolvedValue(EVE)
    renderPage({ id: 'ADM001', role: 'admin' })
    await screen.findByRole('heading', { name: 'Eve Employee' })
    expect(screen.getByRole('link', { name: 'All users' })).toHaveAttribute('href', '/users')
    await user.click(screen.getByRole('button', { name: 'View activity' }))
    expect(await screen.findByText('at /audit-log?actorId=EMP001')).toBeInTheDocument()
  })

  it('shows the empty history and no history section for managers', async () => {
    usersApi.get.mockResolvedValue({ ...EVE, currentProject: null, projects: [] })
    const { unmount } = renderPage({ id: 'ADM001', role: 'admin' })
    expect(await screen.findByText('Not on any project yet.')).toBeInTheDocument()
    unmount()
    usersApi.get.mockResolvedValue({ ...MANAGER, role: 'manager', email: 'mia@x.com', jobTitle: 'Lead', isActive: true, manager: null, projects: [] })
    renderPage({ id: 'ADM001', role: 'admin' }, '/users/MGR001')
    await screen.findByRole('heading', { name: 'Mia Manager' })
    expect(screen.queryByText('Projects')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports to')).not.toBeInTheDocument()
  })

  it('shows the error state', async () => {
    usersApi.get.mockRejectedValue(new Error('Could not reach the server'))
    renderPage({ id: 'ADM001', role: 'admin' })
    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })
})
