import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import { addDays, todayISO } from '../../utils/dates.js'
import ProjectDetailPage from './ProjectDetailPage.jsx'

vi.mock('../../services/projects.js')
vi.mock('../../services/users.js')

const BASE = {
  id: 'PRJ001',
  name: 'Decommission 1,000 Servers',
  description: 'Phase out the legacy fleet',
  status: 'active',
  archived: false,
  startDate: '2026-10-05',
  endDate: '2026-10-30',
  manager: { id: 'MGR001', firstName: 'Mia', lastName: 'Manager' },
  memberCount: 1,
  hoursAssigned: 100,
  hoursCompleted: 10,
  capacityHours: 160,
  capacityHoursPerMember: 160,
  milestoneCounts: { open: 0, complete: 0 },
  myMembership: null,
}
const WITH_COSTS = { ...BASE, budget: 250000, costConsumed: 500, budgetRemaining: 249500 }
const MEMBER = {
  user: { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', jobTitle: 'Engineer' },
  hoursAssigned: 100,
  hoursCompleted: 10,
  capacityHours: 160,
  isActive: true,
  costConsumed: 500,
  currentMilestone: { id: 'MIL001', name: 'Inventory' },
}

function renderPage(user, url = '/projects/PRJ001') {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    usersApi.list.mockResolvedValue({ items: [], total: 0 })
    projectsApi.members.mockResolvedValue({ items: [MEMBER], total: 1 })
    projectsApi.availableMembers.mockResolvedValue({ items: [{ id: 'EMP002', firstName: 'Max', lastName: 'New', jobTitle: 'Analyst' }], total: 1 })
  })

  it('shows the three pillars with money for the manager', async () => {
    projectsApi.get.mockResolvedValue(WITH_COSTS)
    renderPage({ id: 'MGR001', role: 'manager' })
    expect(await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })).toBeInTheDocument()
    expect(screen.getByText('160 h')).toBeInTheDocument()
    expect(screen.getByText('$250,000')).toBeInTheDocument()
    expect(screen.getByText('$249,500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it('hides money and actions from an employee and shows the released banner', async () => {
    projectsApi.get.mockResolvedValue({ ...BASE, myMembership: { isActive: false, releasedAt: '2026-10-20T10:00:00Z', hoursAssigned: 40 } })
    renderPage({ id: 'EMP001', role: 'employee' })
    await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })
    expect(screen.queryByText('Budget')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByText(/You were released from this project/)).toBeInTheDocument()
  })

  it('blocks completion while milestones are open and lets admins archive', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockResolvedValue({ ...WITH_COSTS, milestoneCounts: { open: 2, complete: 1 } })
    projectsApi.archive.mockResolvedValue({ ...WITH_COSTS, archived: true })
    renderPage({ id: 'ADM001', role: 'admin' })
    await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeDisabled()
    expect(screen.getByText(/2 open milestones must be completed/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(projectsApi.archive).toHaveBeenCalledWith('PRJ001'))
    expect(await screen.findByText('Project archived')).toBeInTheDocument()
  })

  it('adds a member from the available list on the Members tab', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockResolvedValue(WITH_COSTS)
    projectsApi.addMember.mockResolvedValue({ ...MEMBER, user: { id: 'EMP002', firstName: 'Max', lastName: 'New' }, hoursAssigned: 80 })
    renderPage({ id: 'MGR001', role: 'manager' })
    await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })
    await user.click(screen.getByRole('tab', { name: /members/i }))
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/milestones/MIL001')

    await user.click(screen.getByRole('button', { name: /add member/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('combobox', { name: /employee/i }))
    await user.click(await screen.findByRole('option', { name: /Max New/ }))
    const hours = within(dialog).getByLabelText(/hours assigned/i, { selector: 'input' })
    await user.clear(hours)
    await user.type(hours, '80')
    await user.click(within(dialog).getByRole('button', { name: /add to project/i }))
    await waitFor(() => expect(projectsApi.addMember).toHaveBeenCalledWith('PRJ001', { userId: 'EMP002', hoursAssigned: 80 }))
    expect(await screen.findByText('Added Max New')).toBeInTheDocument()
  })

  it('opens the tab named in the URL and flags a project past its end date', async () => {
    projectsApi.get.mockResolvedValue({ ...WITH_COSTS, endDate: addDays(todayISO(), -2) })
    renderPage({ id: 'MGR001', role: 'manager' }, '/projects/PRJ001?tab=members')
    await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })
    expect(screen.getByRole('tab', { name: /members/i })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.getByText('Past end date')).toBeInTheDocument()
  })

  it('warns, without blocking, when assigned hours would exceed the project capacity', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockResolvedValue({ ...WITH_COSTS, hoursAssigned: 300 })
    projectsApi.addMember.mockResolvedValue({ ...MEMBER, user: { id: 'EMP002', firstName: 'Max', lastName: 'New' }, hoursAssigned: 40 })
    renderPage({ id: 'MGR001', role: 'manager' }, '/projects/PRJ001?tab=members')
    await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })
    await user.click(await screen.findByRole('button', { name: /add member/i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Project so far: 300 h assigned of 320 h capacity/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('combobox', { name: /employee/i }))
    await user.click(await screen.findByRole('option', { name: /Max New/ }))
    const hours = within(dialog).getByLabelText(/hours assigned/i, { selector: 'input' })
    await user.clear(hours)
    await user.type(hours, '20')
    expect(within(dialog).queryByText(/above the project capacity/)).not.toBeInTheDocument()
    await user.clear(hours)
    await user.type(hours, '40')
    expect(await within(dialog).findByText(/bring assigned hours to 340 h, above the project capacity of 320 h/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /add to project/i }))
    await waitFor(() => expect(projectsApi.addMember).toHaveBeenCalledWith('PRJ001', { userId: 'EMP002', hoursAssigned: 40 }))
  })

  it('tells a manager why a project they do not manage is hidden, with a way out', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockRejectedValue(Object.assign(new Error('You are not on this project'), { status: 403 }))
    render(
      <AuthContext.Provider value={{ status: 'authed', user: { id: 'MGR002', role: 'manager' }, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
        <MemoryRouter initialEntries={['/projects/PRJ001']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects" element={<p>projects list</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(await screen.findByText(/You don't manage this project/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All projects' }))
    expect(await screen.findByText('projects list')).toBeInTheDocument()
  })

  it('rejects hours above capacity before calling the API', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockResolvedValue(WITH_COSTS)
    renderPage({ id: 'MGR001', role: 'manager' })
    await screen.findByRole('heading', { name: 'Decommission 1,000 Servers' })
    await user.click(screen.getByRole('tab', { name: /members/i }))
    await user.click(await screen.findByRole('button', { name: /add member/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('combobox', { name: /employee/i }))
    await user.click(await screen.findByRole('option', { name: /Max New/ }))
    const hours = within(dialog).getByLabelText(/hours assigned/i, { selector: 'input' })
    await user.clear(hours)
    await user.type(hours, '999')
    await user.click(within(dialog).getByRole('button', { name: /add to project/i }))
    expect(await within(dialog).findByText('Enter 0 to 160 hours')).toBeInTheDocument()
    expect(projectsApi.addMember).not.toHaveBeenCalled()
  })
})
