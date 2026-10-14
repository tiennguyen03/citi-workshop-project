import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as milestonesApi from '../../services/milestones.js'
import * as projectsApi from '../../services/projects.js'
import { addDays, todayISO } from '../../utils/dates.js'
import MilestoneDetailPage from './MilestoneDetailPage.jsx'

vi.mock('../../services/milestones.js')
vi.mock('../../services/projects.js')

const EVE = { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', jobTitle: 'Engineer' }
const PROJECT = {
  id: 'PRJ001',
  name: 'Decommission',
  status: 'active',
  archived: false,
  startDate: '2026-10-05',
  endDate: '2026-10-30',
  manager: { id: 'MGR001', firstName: 'Mia', lastName: 'Manager' },
  milestoneCounts: { open: 1, complete: 0 },
  myMembership: null,
}
const MILESTONE = {
  id: 'MIL001',
  projectId: 'PRJ001',
  name: 'Inventory',
  description: '',
  startDate: '2026-10-05',
  dueDate: '2026-10-16',
  status: 'open',
  completedAt: null,
  assignees: [EVE],
  goals: [
    { id: 'GOL001', milestoneId: 'MIL001', title: 'Export CMDB', assignee: EVE, isDone: false, doneAt: null },
    { id: 'GOL002', milestoneId: 'MIL001', title: 'Tag servers', assignee: null, isDone: false, doneAt: null },
  ],
  goalsDone: 0,
  goalsTotal: 2,
}

function renderPage(user) {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/milestones/MIL001']}>
        <Routes>
          <Route path="/milestones/:id" element={<MilestoneDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('MilestoneDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    milestonesApi.get.mockResolvedValue(MILESTONE)
  })

  it('lets the assignee tick their own goal only', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockResolvedValue({ ...PROJECT, myMembership: { isActive: true, hoursAssigned: 80 } })
    milestonesApi.updateGoal.mockResolvedValue({ ...MILESTONE.goals[0], isDone: true })
    renderPage({ id: 'EMP001', role: 'employee' })
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    const mine = await screen.findByRole('checkbox', { name: 'Complete goal Export CMDB' })
    await waitFor(() => expect(mine).toBeEnabled())
    expect(screen.getByRole('checkbox', { name: 'Complete goal Tag servers' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/new goal/i)).not.toBeInTheDocument()
    await user.click(mine)
    await waitFor(() => expect(milestonesApi.updateGoal).toHaveBeenCalledWith('GOL001', { isDone: true }))
    expect(mine).toBeChecked()
  })

  it('lets the manager add goals and complete the milestone with a warning about open goals', async () => {
    const user = userEvent.setup()
    projectsApi.get.mockResolvedValue(PROJECT)
    milestonesApi.createGoal.mockResolvedValue({ id: 'GOL003', milestoneId: 'MIL001', title: 'Flag orphans', assignee: EVE, isDone: false })
    milestonesApi.complete.mockResolvedValue({ ...MILESTONE, status: 'complete', completedAt: '2026-10-20T10:00:00Z', details: { openGoals: 2 } })
    renderPage({ id: 'MGR001', role: 'manager' })
    await screen.findByRole('heading', { name: 'Inventory' })
    await screen.findByRole('button', { name: 'Mark complete' })

    await user.type(screen.getByLabelText(/new goal/i, { selector: 'input' }), 'Flag orphans')
    await user.click(screen.getByRole('combobox', { name: /assignee/i }))
    await user.click(await screen.findByRole('option', { name: 'Eve Employee' }))
    await user.click(screen.getByRole('button', { name: /add goal/i }))
    await waitFor(() => expect(milestonesApi.createGoal).toHaveBeenCalledWith('MIL001', { title: 'Flag orphans', assigneeId: 'EMP001' }))

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/2 goals are still open/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Mark complete' }))
    await waitFor(() => expect(milestonesApi.complete).toHaveBeenCalledWith('MIL001'))
    expect(await screen.findByText('Milestone completed')).toBeInTheDocument()
  })

  it('shows Overdue in the header for an open milestone past its due date, never for a completed one', async () => {
    projectsApi.get.mockResolvedValue(PROJECT)
    milestonesApi.get.mockResolvedValue({ ...MILESTONE, dueDate: addDays(todayISO(), -2) })
    const { unmount } = renderPage({ id: 'MGR001', role: 'manager' })
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(await screen.findByText('Overdue')).toBeInTheDocument()
    unmount()
    milestonesApi.get.mockResolvedValue({ ...MILESTONE, dueDate: addDays(todayISO(), -2), status: 'complete', completedAt: '2026-10-10T10:00:00Z' })
    renderPage({ id: 'MGR001', role: 'manager' })
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })

  it('explains an empty assignee picker to the manager, and disabled goals to a non-assignee', async () => {
    projectsApi.get.mockResolvedValue(PROJECT)
    milestonesApi.get.mockResolvedValue({ ...MILESTONE, assignees: [], goals: [] })
    const { unmount } = renderPage({ id: 'MGR001', role: 'manager' })
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(await screen.findByText(/Goals can only be given to people on this milestone/)).toBeInTheDocument()
    unmount()
    projectsApi.get.mockResolvedValue({ ...PROJECT, myMembership: { isActive: true, hoursAssigned: 80 } })
    milestonesApi.get.mockResolvedValue(MILESTONE)
    renderPage({ id: 'EMP002', role: 'employee' })
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(await screen.findByText('Only people assigned to this milestone can tick its goals.')).toBeInTheDocument()
  })

  it('is read-only on an archived project', async () => {
    projectsApi.get.mockResolvedValue({ ...PROJECT, archived: true })
    renderPage({ id: 'ADM001', role: 'admin' })
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(await screen.findByText(/archived, so the milestone is read-only/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Complete goal Export CMDB' })).toBeDisabled()
  })
})
