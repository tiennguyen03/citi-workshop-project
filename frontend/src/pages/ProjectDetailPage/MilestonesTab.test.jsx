import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as milestonesApi from '../../services/milestones.js'
import { addDays, todayISO } from '../../utils/dates.js'
import { defaultMilestoneStart } from '../../utils/milestoneForm.js'
import MilestonesTab from './MilestonesTab.jsx'

vi.mock('../../services/milestones.js')

const PROJECT = { id: 'PRJ001', name: 'Decommission', status: 'active', archived: false, startDate: '2026-10-05', endDate: '2026-10-30' }
const EVE = { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', jobTitle: 'Engineer' }
const MAX = { id: 'EMP002', firstName: 'Max', lastName: 'New', jobTitle: 'Analyst' }
const MILESTONE = {
  id: 'MIL001',
  projectId: 'PRJ001',
  name: 'Inventory',
  description: 'Catalogue every server',
  startDate: '2026-10-05',
  dueDate: '2026-10-16',
  status: 'open',
  completedAt: null,
  assignees: [EVE],
  goals: [],
  goalsDone: 1,
  goalsTotal: 3,
}

function renderTab(canManage) {
  const notify = vi.fn()
  render(
    <MemoryRouter initialEntries={['/projects/PRJ001']}>
      <Routes>
        <Route path="/projects/:id" element={<MilestonesTab project={PROJECT} canManage={canManage} onChanged={vi.fn()} notify={notify} />} />
        <Route path="/milestones/:id" element={<p>milestone page</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return notify
}

describe('MilestonesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    milestonesApi.list.mockResolvedValue({ items: [MILESTONE], total: 1 })
    milestonesApi.availableAssignees.mockResolvedValue({
      items: [MAX],
      busy: [{ user: EVE, milestone: { id: 'MIL001', name: 'Inventory' } }],
      total: 1,
    })
  })

  it('lists milestones with progress and opens the detail page on click', async () => {
    const user = userEvent.setup()
    renderTab(false)
    expect(await screen.findByText('Inventory')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new milestone/i })).not.toBeInTheDocument()
    await user.click(screen.getByText('Inventory'))
    expect(await screen.findByText('milestone page')).toBeInTheDocument()
  })

  it('orders open milestones by due date with urgency cues, completed ones last', async () => {
    const today = todayISO()
    milestonesApi.list.mockResolvedValue({
      items: [
        { ...MILESTONE, id: 'MIL003', name: 'Wrap up', status: 'complete', dueDate: addDays(today, -20), completedAt: '2026-10-01T10:00:00Z' },
        { ...MILESTONE, id: 'MIL002', name: 'Power-down', dueDate: addDays(today, 3) },
        { ...MILESTONE, id: 'MIL001', name: 'Inventory', dueDate: addDays(today, -1) },
      ],
      total: 3,
    })
    renderTab(false)
    await screen.findByText('Wrap up')
    const names = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent)
    expect(names[0]).toMatch(/^InventoryNext due/)
    expect(names[1]).toMatch(/^Power-down/)
    expect(names[2]).toMatch(/^Wrap up/)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Due in 3 days')).toBeInTheDocument()
    expect(screen.getAllByText('Next due')).toHaveLength(1)
  })

  it('lets a manager create a milestone, offering only free members', async () => {
    const user = userEvent.setup()
    milestonesApi.create.mockResolvedValue({ ...MILESTONE, id: 'MIL002', name: 'Power-down', assignees: [MAX] })
    const notify = renderTab(true)
    await screen.findByText('Inventory')
    expect(screen.getByText('Free for a new milestone: Max New.')).toBeInTheDocument()
    expect(screen.queryByText(/Who is on what/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /new milestone/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^name/i, { selector: 'input' }), 'Power-down')
    const due = within(dialog).getByLabelText(/due date/i, { selector: 'input' })
    await user.clear(due)
    await user.type(due, '2026-10-23')
    await user.click(within(dialog).getByRole('combobox', { name: /assignees/i }))
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByRole('option', { name: /Eve Employee/ })).toHaveAttribute('aria-disabled', 'true')
    await user.click(within(listbox).getByRole('option', { name: /Max New/ }))
    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByRole('button', { name: /create milestone/i }))
    await waitFor(() =>
      expect(milestonesApi.create).toHaveBeenCalledWith('PRJ001', {
        name: 'Power-down',
        description: '',
        startDate: defaultMilestoneStart(PROJECT),
        dueDate: '2026-10-23',
        assigneeIds: ['EMP002'],
      }),
    )
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Created milestone 'Power-down'"))
  })

  it('shows a conflict from the server against the assignee field', async () => {
    const user = userEvent.setup()
    milestonesApi.create.mockRejectedValue(
      Object.assign(new Error('Some assignees are already on an open milestone'), {
        status: 409,
        code: 'MILESTONE_CONFLICT',
        details: { userIds: ['EMP002'], milestoneId: 'MIL001', conflicts: [{ userId: 'EMP002', milestoneId: 'MIL001', milestoneName: 'Inventory' }] },
      }),
    )
    renderTab(true)
    await screen.findByText('Inventory')
    await user.click(screen.getByRole('button', { name: /new milestone/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^name/i, { selector: 'input' }), 'Clash')
    const due = within(dialog).getByLabelText(/due date/i, { selector: 'input' })
    await user.type(due, '2026-10-23')
    await user.click(within(dialog).getByRole('button', { name: /create milestone/i }))
    expect(await within(dialog).findByText(/Max New is on 'Inventory'/)).toBeInTheDocument()
  })

  it('rejects dates outside the project before calling the API', async () => {
    const user = userEvent.setup()
    renderTab(true)
    await screen.findByText('Inventory')
    await user.click(screen.getByRole('button', { name: /new milestone/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^name/i, { selector: 'input' }), 'Late')
    await user.type(within(dialog).getByLabelText(/due date/i, { selector: 'input' }), '2026-11-30')
    await user.click(within(dialog).getByRole('button', { name: /create milestone/i }))
    expect(await within(dialog).findByText(/On or before the project end/)).toBeInTheDocument()
    expect(milestonesApi.create).not.toHaveBeenCalled()
  })
})
