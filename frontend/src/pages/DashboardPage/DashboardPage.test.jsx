import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as dashboardApi from '../../services/dashboard.js'
import * as milestonesApi from '../../services/milestones.js'
import * as timeEntriesApi from '../../services/timeEntries.js'
import DashboardPage from './DashboardPage.jsx'

vi.mock('../../services/dashboard.js')
vi.mock('../../services/milestones.js')
vi.mock('../../services/timeEntries.js')

const CARD = {
  id: 'PRJ001',
  name: 'Decommission',
  status: 'active',
  archived: false,
  startDate: '2020-01-01',
  endDate: '2099-12-31',
  memberCount: 3,
  hoursAssigned: 100,
  hoursCompleted: 40,
  capacityHours: 160,
  milestoneCounts: { open: 2, complete: 1 },
}
const WEEK = { start: '2026-10-12', end: '2026-10-18' }

function renderPage(user) {
  render(
    <AuthContext.Provider value={{ status: 'authed', user, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/:id" element={<p>project page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows office stats and the attention list for an admin', async () => {
    const user = userEvent.setup()
    dashboardApi.get.mockResolvedValue({
      role: 'admin',
      stats: { activeProjects: 3, completeProjects: 1, archivedProjects: 1, users: { admin: 1, manager: 3, employee: 12 }, availableEmployees: 4 },
      attention: [{ ...CARD, budget: 100, costConsumed: 250, budgetRemaining: -150, reasons: ['over_budget'] }],
    })
    renderPage({ id: 'ADM001', role: 'admin', firstName: 'System' })
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Available/ })).toHaveAttribute('href', '/users?available=true')
    expect(screen.getByText('Over budget')).toBeInTheDocument()
    expect(screen.getByText('-$150')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
    await user.click(screen.getByText('Decommission'))
    expect(await screen.findByText('project page')).toBeInTheDocument()
  })

  it('shows project cards and team availability for a manager', async () => {
    dashboardApi.get.mockResolvedValue({
      role: 'manager',
      projects: [{ ...CARD, budget: 1000, costConsumed: 200, budgetRemaining: 800, reasons: [] }],
      team: [
        { user: { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', jobTitle: 'Engineer' }, currentProject: { id: 'PRJ001', name: 'Decommission' }, hoursThisWeek: 16 },
        { user: { id: 'EMP002', firstName: 'Max', lastName: 'New', jobTitle: 'Analyst' }, currentProject: null, hoursThisWeek: 0 },
      ],
      week: WEEK,
    })
    renderPage({ id: 'MGR001', role: 'manager', firstName: 'Mia' })
    expect(await screen.findByText('$800')).toBeInTheDocument()
    expect(screen.getByText('40 h completed of 160 h capacity')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('16 h')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Decommission' })).toHaveAttribute('href', '/projects/PRJ001')
    expect(screen.getByRole('link', { name: '3 members' })).toHaveAttribute('href', '/projects/PRJ001?tab=members')
    expect(screen.getByRole('link', { name: '2 open milestones' })).toHaveAttribute('href', '/projects/PRJ001?tab=milestones')
  })

  it('measures the employee week against 40 hours and flags overdue goals', async () => {
    dashboardApi.get.mockResolvedValue({
      role: 'employee',
      currentProject: { ...CARD, myHoursAssigned: 80, myHoursCompleted: 20, currentMilestone: null },
      pastProjects: [],
      openGoals: [{ id: 'GOL001', title: 'Export CMDB', milestone: { id: 'MIL001', name: 'Inventory', dueDate: '2020-01-01' }, project: { id: 'PRJ001', name: 'Decommission' } }],
      hoursThisWeek: 42,
      week: WEEK,
    })
    renderPage({ id: 'EMP001', role: 'employee', firstName: 'Eve' })
    expect(await screen.findByText('42 h of 40 h · over the 40-hour week')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('shows the error state when the dashboard cannot load', async () => {
    dashboardApi.get.mockRejectedValue(new Error('Could not reach the server'))
    renderPage({ id: 'EMP001', role: 'employee', firstName: 'Eve' })
    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('lets an employee tick a goal and log time from the landing page', async () => {
    const user = userEvent.setup()
    dashboardApi.get.mockResolvedValue({
      role: 'employee',
      currentProject: { ...CARD, myHoursAssigned: 80, myHoursCompleted: 20, currentMilestone: { id: 'MIL001', name: 'Inventory' } },
      pastProjects: [{ ...CARD, id: 'PRJ000', name: 'Old one', status: 'complete' }],
      openGoals: [{ id: 'GOL001', title: 'Export CMDB', milestone: { id: 'MIL001', name: 'Inventory', dueDate: '2026-10-16' }, project: { id: 'PRJ001', name: 'Decommission' } }],
      hoursThisWeek: 12,
      week: WEEK,
    })
    milestonesApi.updateGoal.mockResolvedValue({})
    timeEntriesApi.create.mockResolvedValue({ id: 'TIM001', hours: 3 })
    renderPage({ id: 'EMP001', role: 'employee', firstName: 'Eve' })
    expect(await screen.findByText('20 h logged of 80 h assigned to you')).toBeInTheDocument()
    expect(screen.getByText('Old one')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Complete goal Export CMDB' }))
    await waitFor(() => expect(milestonesApi.updateGoal).toHaveBeenCalledWith('GOL001', { isDone: true }))
    expect(await screen.findByText('Done: Export CMDB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /log time/i }))
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText(/hours/i, { selector: 'input' }), '3')
    await user.click(screen.getByRole('button', { name: /^log time$/i }))
    await waitFor(() => expect(timeEntriesApi.create).toHaveBeenCalledWith('PRJ001', expect.objectContaining({ hours: 3 })))
    expect(await screen.findByText('Logged 3 h on Decommission')).toBeInTheDocument()
  })

  it('shows the available state for an employee without a project', async () => {
    dashboardApi.get.mockResolvedValue({ role: 'employee', currentProject: null, pastProjects: [], openGoals: [], hoursThisWeek: 0, week: WEEK })
    renderPage({ id: 'EMP002', role: 'employee', firstName: 'Max' })
    expect(await screen.findByText(/not assigned to a project right now/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log time/i })).not.toBeInTheDocument()
  })
})
