import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import { addDays, todayISO } from '../../utils/dates.js'
import ProjectsPage from './ProjectsPage.jsx'

vi.mock('../../services/projects.js')
vi.mock('../../services/users.js')

const PROJECT = {
  id: 'PRJ001',
  name: 'Decommission 1,000 Servers',
  status: 'active',
  archived: false,
  startDate: '2026-10-05',
  endDate: '2026-10-30',
  manager: { id: 'MGR001', firstName: 'Mia', lastName: 'Manager' },
  memberCount: 3,
  hoursAssigned: 300,
  hoursCompleted: 120,
  capacityHours: 480,
  completedGoals: 1,
  totalGoals: 3,
}

function renderPage(role, url = '/projects') {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user: { id: 'ME0001', role }, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<p>project detail</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    usersApi.list.mockResolvedValue({ items: [{ id: 'MGR001', firstName: 'Mia', lastName: 'Manager', isActive: true }], total: 1 })
  })

  it('lists projects with goal progress beside capacity used, and opens the detail page', async () => {
    projectsApi.list.mockResolvedValue({ items: [PROJECT], total: 1 })
    renderPage('manager')
    expect(await screen.findByText('Decommission 1,000 Servers')).toBeInTheDocument()
    expect(screen.queryByText('Mia Manager')).not.toBeInTheDocument() // a manager's own list has no Manager column
    expect(screen.getByText('1 / 3 goals')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument() // Progress = goals
    expect(screen.getByText('120 / 480 h')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument() // Capacity used = hours
    expect(screen.getByRole('columnheader', { name: 'Capacity used' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByText('Decommission 1,000 Servers'))
    expect(screen.getByText('project detail')).toBeInTheDocument()
  })

  it('lets an admin create and toggle archived projects', async () => {
    const user = userEvent.setup()
    projectsApi.list.mockResolvedValue({ items: [], total: 0 })
    renderPage('admin')
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument()
    expect(projectsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ archived: undefined, limit: 10, offset: 0 }))
    await user.click(screen.getByLabelText(/show archived/i))
    await waitFor(() => expect(projectsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ archived: 'true' })))
    expect(await screen.findByText('No archived projects.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /new project/i }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('New project')
  })

  it('creates a project from the dialog, validating first, and opens it', async () => {
    const user = userEvent.setup()
    projectsApi.list.mockResolvedValue({ items: [], total: 0 })
    projectsApi.create.mockResolvedValue({ id: 'PRJ009' })
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: /new project/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /create project/i }))
    expect(await within(dialog).findAllByText('Required')).not.toHaveLength(0)
    expect(within(dialog).getByText('Choose a manager')).toBeInTheDocument()
    expect(projectsApi.create).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText(/project name/i, { selector: 'input' }), 'Portal Redesign')
    await user.type(within(dialog).getByLabelText(/budget/i, { selector: 'input' }), '50000')
    await user.type(within(dialog).getByLabelText(/start date/i, { selector: 'input' }), '2026-11-02')
    await user.type(within(dialog).getByLabelText(/end date/i, { selector: 'input' }), '2026-11-01')
    await user.click(within(dialog).getByRole('combobox', { name: /manager/i }))
    await user.click(await screen.findByRole('option', { name: 'Mia Manager' }))
    await user.click(within(dialog).getByRole('button', { name: /create project/i }))
    expect(await within(dialog).findByText('Must be on or after the start date')).toBeInTheDocument()

    const end = within(dialog).getByLabelText(/end date/i, { selector: 'input' })
    await user.clear(end)
    await user.type(end, '2026-11-27')
    await user.click(within(dialog).getByRole('button', { name: /create project/i }))
    await waitFor(() =>
      expect(projectsApi.create).toHaveBeenCalledWith({
        name: 'Portal Redesign',
        description: '',
        budget: 50000,
        startDate: '2026-11-02',
        endDate: '2026-11-27',
        managerId: 'MGR001',
      }),
    )
    expect(await screen.findByText('project detail')).toBeInTheDocument()
  })

  it('flags an active project past its end date', async () => {
    projectsApi.list.mockResolvedValue({ items: [{ ...PROJECT, endDate: addDays(todayISO(), -1) }, { ...PROJECT, id: 'PRJ002', name: 'On time', endDate: addDays(todayISO(), 30) }], total: 2 })
    renderPage('manager')
    await screen.findByText('On time')
    expect(screen.getAllByText('Past end date')).toHaveLength(1)
  })

  it('sends search and status to the API, mirrored in the URL', async () => {
    const user = userEvent.setup()
    projectsApi.list.mockResolvedValue({ items: [PROJECT], total: 1 })
    renderPage('admin')
    await screen.findByText('Decommission 1,000 Servers')
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'bell')
    await waitFor(() => expect(projectsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'bell', offset: 0 })))
    projectsApi.list.mockResolvedValue({ items: [], total: 0 })
    await user.click(screen.getByRole('combobox', { name: /status/i }))
    await user.click(await screen.findByRole('option', { name: 'Active' }))
    await waitFor(() => expect(projectsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'bell', status: 'active' })))
    expect(await screen.findByText('No projects match your filters.')).toBeInTheDocument()
  })

  it('reads filters and the page from the URL and pages with the footer', async () => {
    const user = userEvent.setup()
    projectsApi.list.mockResolvedValue({ items: [{ ...PROJECT, id: 'PRJ002', name: 'Customer Portal', status: 'complete' }], total: 26 })
    renderPage('admin', '/projects?status=complete')
    expect(await screen.findByText('Customer Portal')).toBeInTheDocument()
    expect(projectsApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'complete', limit: 10, offset: 0 }))
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveTextContent('Complete')
    expect(screen.getByText('Mia Manager')).toBeInTheDocument() // admins do see the manager
    expect(screen.getByText('1–10 of 26')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => expect(projectsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'complete', offset: 10 })))
  })

  it('shows the employee empty state and errors', async () => {
    projectsApi.list.mockResolvedValue({ items: [], total: 0 })
    const { unmount } = renderPage('employee')
    expect(await screen.findByText('You are not on a project yet.')).toBeInTheDocument()
    unmount()
    projectsApi.list.mockRejectedValue(new Error('boom'))
    renderPage('employee')
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
