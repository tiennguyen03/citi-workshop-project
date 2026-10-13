import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as projectsApi from '../../services/projects.js'
import ProjectsPage from './ProjectsPage.jsx'

vi.mock('../../services/projects.js')

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
}

function renderPage(role) {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user: { id: 'ME0001', role }, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<p>new project form</p>} />
          <Route path="/projects/:id" element={<p>project detail</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProjectsPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists projects with hours progress and opens the detail page', async () => {
    projectsApi.list.mockResolvedValue({ items: [PROJECT], total: 1 })
    renderPage('manager')
    expect(await screen.findByText('Decommission 1,000 Servers')).toBeInTheDocument()
    expect(screen.getByText('Mia Manager')).toBeInTheDocument()
    expect(screen.getByText('120 h of 480 h')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByText('Decommission 1,000 Servers'))
    expect(screen.getByText('project detail')).toBeInTheDocument()
  })

  it('lets an admin create and toggle archived projects', async () => {
    const user = userEvent.setup()
    projectsApi.list.mockResolvedValue({ items: [], total: 0 })
    renderPage('admin')
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument()
    expect(projectsApi.list).toHaveBeenLastCalledWith({ archived: undefined })
    await user.click(screen.getByLabelText(/show archived/i))
    await waitFor(() => expect(projectsApi.list).toHaveBeenLastCalledWith({ archived: 'true' }))
    expect(await screen.findByText('No archived projects.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /new project/i }))
    expect(screen.getByText('new project form')).toBeInTheDocument()
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
