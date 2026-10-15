import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as dashboardApi from '../../services/dashboard.js'
import * as milestonesApi from '../../services/milestones.js'
import * as timeEntriesApi from '../../services/timeEntries.js'
import * as usersApi from '../../services/users.js'
import DashboardPage from './DashboardPage.jsx'

vi.mock('../../services/dashboard.js')
vi.mock('../../services/milestones.js')
vi.mock('../../services/timeEntries.js')
vi.mock('../../services/users.js')
vi.mock('../../services/projects.js')

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
const EVE = { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', jobTitle: 'Engineer', role: 'employee' }
const MAX = { id: 'EMP002', firstName: 'Max', lastName: 'New', jobTitle: 'Analyst', role: 'employee' }
const ENTRY = { id: 'TIM001', projectId: 'PRJ001', user: EVE, entryDate: '2026-10-05', hours: 8, note: 'Inventory', createdAt: '2026-10-05T10:00:00Z' }

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
    usersApi.list.mockResolvedValue({ items: [], total: 0 })
  })

  it('shows the portfolio tiles, the health board and recent activity for an admin', async () => {
    const user = userEvent.setup()
    const MGR = { id: 'MGR001', firstName: 'Mia', lastName: 'Manager' }
    dashboardApi.get.mockResolvedValue({
      role: 'admin',
      projects: [
        { ...CARD, manager: MGR, nextDueDate: '2020-01-01', budget: 100, costConsumed: 250, budgetRemaining: -150, reasons: ['over_budget', 'overdue_milestone'], health: 'at_risk' },
        { ...CARD, id: 'PRJ002', name: 'Empty shell', manager: MGR, nextDueDate: null, budget: 1000, costConsumed: 0, budgetRemaining: 1000, reasons: ['no_members', 'no_milestones'], health: 'needs_setup' },
        { ...CARD, id: 'PRJ003', name: 'Old portal', status: 'complete', manager: MGR, nextDueDate: null, budget: 500, costConsumed: 400, budgetRemaining: 100, reasons: [], health: 'to_close' },
      ],
      summary: { projects: { late: 0, atRisk: 1, needsSetup: 1, toClose: 1, onTrack: 0 }, hoursCompleted: 140, capacityHours: 4160, budget: 1100, costConsumed: 250 },
      people: { employees: 12, onProject: 8, available: 4 },
      recentActivity: [
        { id: 1, occurredAt: '2026-10-14T09:00:00Z', actor: EVE, actorRole: 'employee', action: 'time_entry.create', entityType: 'time_entry', entityId: 'TIM001', projectId: 'PRJ001', summary: 'Logged 6 h', details: {}, statusCode: 201 },
        { id: 2, occurredAt: '2026-10-14T08:00:00Z', actor: null, actorRole: null, action: 'auth.login_failed', entityType: 'user', entityId: null, projectId: null, summary: 'Failed login for ghost', details: {}, statusCode: 401 },
      ],
    })
    renderPage({ id: 'ADM001', role: 'admin', firstName: 'System' })
    expect(await screen.findByText('140 h')).toBeInTheDocument()
    expect(screen.getByText('of 4,160 h capacity on active projects')).toBeInTheDocument()
    expect(screen.getByText('$250')).toBeInTheDocument()
    expect(screen.getByText('of $1,100 planned on active projects')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /4 available/i })).toHaveAttribute('href', '/users?available=true')
    expect(screen.getByLabelText('Projects by health')).toHaveTextContent(/1\s*At risk\s*1\s*Needs setup\s*1\s*Done, not archived/)
    expect(screen.getAllByText('At risk')).toHaveLength(2) // the summary row and the board tag
    expect(screen.getAllByText('Needs setup')).toHaveLength(2) // summary row + board tag
    expect(screen.getAllByText('Done, not archived')).toHaveLength(2) // summary row + board tag
    expect(screen.getAllByText('Mia Manager')).toHaveLength(3)
    expect(screen.getByText('Overdue')).toBeInTheDocument() // next due on the at-risk row; complete rows carry no cue
    expect(screen.getByText('Over budget, overdue milestone')).toBeInTheDocument() // reasons as one muted line under the health tag
    expect(screen.getByText('No members, no milestones')).toBeInTheDocument()
    expect(screen.getByText('Logged 6 h')).toBeInTheDocument()
    expect(screen.getByText('Logged time')).toBeInTheDocument()
    expect(screen.getByText('Failed login for ghost')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument()
    expect(screen.getByText('-$150')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /new project/i }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('New project')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByText('Decommission'))
    expect(await screen.findByText('project page')).toBeInTheDocument()
  })

  it('shows project cards and team availability for a manager', async () => {
    dashboardApi.get.mockResolvedValue({
      role: 'manager',
      projects: [{ ...CARD, budget: 1000, costConsumed: 200, budgetRemaining: 800, reasons: [], health: 'on_track', nextDueDate: '2020-01-01' }],
      dueSoon: [
        { id: 'MIL001', name: 'Inventory', dueDate: '2020-01-01', project: { id: 'PRJ001', name: 'Decommission' }, assignees: [EVE] },
        { id: 'MIL002', name: 'Power-down', dueDate: '2099-12-31', project: { id: 'PRJ001', name: 'Decommission' }, assignees: [] },
      ],
      team: [
        { user: EVE, currentProject: { id: 'PRJ001', name: 'Decommission' }, currentMilestone: { id: 'MIL001', name: 'Inventory' }, hoursThisWeek: 16 },
        { user: MAX, currentProject: null, currentMilestone: null, hoursThisWeek: 0 },
        { user: { ...EVE, id: 'EMP003', firstName: 'Quiet', lastName: 'One' }, currentProject: { id: 'PRJ001', name: 'Decommission' }, currentMilestone: null, hoursThisWeek: 0 },
      ],
      week: WEEK,
    })
    renderPage({ id: 'MGR001', role: 'manager', firstName: 'Mia' })
    expect(await screen.findByText('$800')).toBeInTheDocument()
    expect(screen.getByText('40 h / 160 h')).toBeInTheDocument()
    expect(screen.getByText('25% complete')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument() // the card leads with health, not lifecycle
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getAllByText('16 h')).toHaveLength(2) // the team summary and Quiet's row
    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByLabelText('Team hours this week')).toHaveTextContent(/16 h\s*logged this week\s*80 h\s*capacity for 2 on a project/) // Eve + Quiet are on a project, Max is not
    // due soon: the overdue one is flagged, the unassigned one says so, both link to the milestone
    expect(screen.getAllByText('Overdue')).toHaveLength(2) // card "Next due" + the Due soon row
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Power-down' })).toHaveAttribute('href', '/milestones/MIL002')
    // team: current milestone column and the zero-hour nudge only for someone on a project
    for (const link of screen.getAllByRole('link', { name: 'Inventory' })) expect(link).toHaveAttribute('href', '/milestones/MIL001') // due-soon row + team row
    expect(screen.getAllByText('0 h')).toHaveLength(2) // Max (available, plain "0 h") and Quiet (on a project, tagged)
    expect(within(screen.getByRole('row', { name: /Quiet One/ })).getByText('0 h')).toBeInTheDocument()
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
      recentEntries: [],
      hoursThisWeek: 42,
      week: WEEK,
    })
    renderPage({ id: 'EMP001', role: 'employee', firstName: 'Eve' })
    expect(await screen.findByText(/over the 40-hour week/i)).toBeInTheDocument()
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
      currentProject: {
        ...CARD,
        myHoursAssigned: 80,
        myHoursCompleted: 20,
        currentMilestone: { id: 'MIL001', name: 'Inventory', dueDate: '2099-12-31', assignees: [EVE, MAX] },
      },
      pastProjects: [{ ...CARD, id: 'PRJ000', name: 'Old one', status: 'complete' }],
      openGoals: [{ id: 'GOL001', title: 'Export CMDB', milestone: { id: 'MIL001', name: 'Inventory', dueDate: '2026-10-16' }, project: { id: 'PRJ001', name: 'Decommission' } }],
      recentEntries: [ENTRY],
      hoursThisWeek: 12,
      week: WEEK,
    })
    milestonesApi.updateGoal.mockResolvedValue({})
    timeEntriesApi.create.mockResolvedValue({ id: 'TIM001', hours: 3 })
    timeEntriesApi.update.mockResolvedValue({ ...ENTRY, hours: 7 })
    renderPage({ id: 'EMP001', role: 'employee', firstName: 'Eve' })
    expect(await screen.findByText('20 / 80 h assigned to you')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('Old one')).toBeInTheDocument()
    expect(screen.getByText('Working with')).toBeInTheDocument()
    expect(screen.getByText('Max New')).toBeInTheDocument() // the teammate, not me
    expect(screen.queryByText('Eve Employee')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All my time' })).toHaveAttribute('href', '/projects/PRJ001?tab=time')
    // recent entry can be edited in place
    await user.click(screen.getByRole('button', { name: 'Edit time entry on Oct 5, 2026' }))
    const editDialog = await screen.findByRole('dialog')
    const hoursField = within(editDialog).getByLabelText(/hours/i, { selector: 'input' })
    await user.clear(hoursField)
    await user.type(hoursField, '7')
    await user.click(within(editDialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(timeEntriesApi.update).toHaveBeenCalledWith('TIM001', expect.objectContaining({ hours: 7 })))
    expect(await screen.findByText('Time entry updated')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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
    dashboardApi.get.mockResolvedValue({ role: 'employee', currentProject: null, pastProjects: [], openGoals: [], recentEntries: [], hoursThisWeek: 0, week: WEEK })
    renderPage({ id: 'EMP002', role: 'employee', firstName: 'Max' })
    expect(await screen.findByText(/not assigned to a project right now/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log time/i })).not.toBeInTheDocument()
  })
})
