import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as timeEntriesApi from '../../services/timeEntries.js'
import TimeTab from './TimeTab.jsx'
import { todayISO, weekRange } from '../../utils/dates.js'

vi.mock('../../services/timeEntries.js')

const EVE = { id: 'EMP001', firstName: 'Eve', lastName: 'Employee', jobTitle: 'Engineer' }
const MAX = { id: 'EMP002', firstName: 'Max', lastName: 'New', jobTitle: 'Analyst' }
const PROJECT = {
  id: 'PRJ001',
  name: 'Decommission',
  status: 'active',
  archived: false,
  startDate: '2020-01-01',
  endDate: '2099-12-31',
  myMembership: { isActive: true, hoursAssigned: 80 },
}
const ENTRIES = [
  { id: 'TIM001', projectId: 'PRJ001', user: EVE, entryDate: '2026-10-05', hours: 8, note: 'Inventory', createdAt: '2026-10-05T10:00:00Z' },
  { id: 'TIM002', projectId: 'PRJ001', user: MAX, entryDate: '2026-10-06', hours: 4, note: '', createdAt: '2026-10-06T10:00:00Z' },
]

function renderTab(user, project = PROJECT, canManage = false) {
  const notify = vi.fn()
  render(
    <AuthContext.Provider value={{ status: 'authed', user, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter>
        <TimeTab project={project} canManage={canManage} onChanged={vi.fn()} notify={notify} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return notify
}

describe('TimeTab', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    timeEntriesApi.list.mockResolvedValue({ items: ENTRIES, total: 2 })
  })

  it('lets an active member log time and sends the entry to the API', async () => {
    const user = userEvent.setup()
    timeEntriesApi.create.mockResolvedValue({ ...ENTRIES[0], id: 'TIM003', hours: 6.5 })
    const notify = renderTab({ id: 'EMP001', role: 'employee' })
    expect(await screen.findByText('12 h')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /log time/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/date/i, { selector: 'input' })).toHaveValue(todayISO())
    await user.type(within(dialog).getByLabelText(/hours/i, { selector: 'input' }), '6.5')
    await user.type(within(dialog).getByLabelText(/note/i, { selector: 'textarea' }), 'Rack audit')
    await user.click(within(dialog).getByRole('button', { name: /^log time$/i }))
    await waitFor(() =>
      expect(timeEntriesApi.create).toHaveBeenCalledWith('PRJ001', { entryDate: todayISO(), hours: 6.5, note: 'Rack audit' }),
    )
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Logged 6.5 h'))
  })

  it('rejects bad hours and future dates before calling the API', async () => {
    const user = userEvent.setup()
    renderTab({ id: 'EMP001', role: 'employee' })
    await screen.findByText('12 h')
    await user.click(screen.getByRole('button', { name: /log time/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/hours/i, { selector: 'input' }), '0.1')
    const date = within(dialog).getByLabelText(/date/i, { selector: 'input' })
    await user.clear(date)
    await user.type(date, '2099-01-01')
    await user.click(within(dialog).getByRole('button', { name: /^log time$/i }))
    expect(await within(dialog).findByText('Between 0.25 and 24')).toBeInTheDocument()
    expect(within(dialog).getByText('Cannot be in the future')).toBeInTheDocument()
    expect(timeEntriesApi.create).not.toHaveBeenCalled()
  })

  it('hides logging from released members and shows the person column to managers', async () => {
    renderTab({ id: 'EMP001', role: 'employee' }, { ...PROJECT, myMembership: { isActive: false } })
    await screen.findByText('12 h')
    expect(screen.queryByRole('button', { name: /log time/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument()
  })

  it('lets the manager filter by person and delete an entry', async () => {
    const user = userEvent.setup()
    timeEntriesApi.remove.mockResolvedValue(null)
    const notify = renderTab({ id: 'MGR001', role: 'manager' }, { ...PROJECT, myMembership: null }, true)
    expect(await screen.findByText('Max New')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log time/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete entry on oct 6, 2026/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(timeEntriesApi.remove).toHaveBeenCalledWith('TIM002'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Time entry deleted'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('combobox', { name: /person/i }))
    await user.click(await screen.findByRole('option', { name: 'Max New' }))
    await waitFor(() => expect(timeEntriesApi.list).toHaveBeenLastCalledWith('PRJ001', { userId: 'EMP002' }))
  })

  it('narrows the entries to this or last week', async () => {
    const user = userEvent.setup()
    renderTab({ id: 'EMP001', role: 'employee' })
    await screen.findByText('12 h')
    await user.click(screen.getByRole('button', { name: 'This week' }))
    await waitFor(() => expect(timeEntriesApi.list).toHaveBeenLastCalledWith('PRJ001', { userId: undefined, ...weekRange('this') }))
    await user.click(screen.getByRole('button', { name: 'Last week' }))
    await waitFor(() => expect(timeEntriesApi.list).toHaveBeenLastCalledWith('PRJ001', { userId: undefined, ...weekRange('last') }))
    expect(screen.getByText(/entries last week/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => expect(timeEntriesApi.list).toHaveBeenLastCalledWith('PRJ001', { userId: undefined }))
  })
})
