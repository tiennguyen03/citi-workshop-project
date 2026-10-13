import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import ProjectFormPage from './ProjectFormPage.jsx'

vi.mock('../../services/projects.js')
vi.mock('../../services/users.js')

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/new']}>
      <Routes>
        <Route path="/projects/new" element={<ProjectFormPage />} />
        <Route path="/projects/:id" element={<p>created detail</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProjectFormPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    usersApi.list.mockResolvedValue({ items: [{ id: 'MGR001', firstName: 'Mia', lastName: 'Manager', isActive: true }], total: 1 })
  })

  it('validates before submitting and then creates the project', async () => {
    const user = userEvent.setup()
    projectsApi.create.mockResolvedValue({ id: 'PRJ001' })
    renderPage()
    await screen.findByRole('combobox', { name: /manager/i })
    await user.click(screen.getByRole('button', { name: /create project/i }))
    expect(await screen.findAllByText('Required')).not.toHaveLength(0)
    expect(screen.getByText('Choose a manager')).toBeInTheDocument()
    expect(projectsApi.create).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/project name/i, { selector: 'input' }), 'Portal Redesign')
    await user.type(screen.getByLabelText(/budget/i, { selector: 'input' }), '50000')
    await user.type(screen.getByLabelText(/start date/i, { selector: 'input' }), '2026-11-02')
    await user.type(screen.getByLabelText(/end date/i, { selector: 'input' }), '2026-11-01')
    await user.click(screen.getByRole('combobox', { name: /manager/i }))
    await user.click(await screen.findByRole('option', { name: 'Mia Manager' }))
    await user.click(screen.getByRole('button', { name: /create project/i }))
    expect(await screen.findByText('Must be on or after the start date')).toBeInTheDocument()

    const end = screen.getByLabelText(/end date/i, { selector: 'input' })
    await user.clear(end)
    await user.type(end, '2026-11-27')
    await user.click(screen.getByRole('button', { name: /create project/i }))
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
    expect(await screen.findByText('created detail')).toBeInTheDocument()
  })
})
