import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as usersApi from '../../services/users.js'
import UsersPage from './UsersPage.jsx'

vi.mock('../../services/users.js')

const MANAGER = { id: 'MGR001', firstName: 'Mia', lastName: 'Manager', role: 'manager', jobTitle: 'Lead', email: 'mia@x.com', isActive: true }
const EMPLOYEE = {
  id: 'EMP001',
  firstName: 'Eve',
  lastName: 'Employee',
  role: 'employee',
  jobTitle: 'Engineer',
  email: 'eve@x.com',
  isActive: true,
  currentProject: null,
}

function renderPage(role = 'admin') {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user: { id: 'ME0001', role }, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:id" element={<p>detail page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lists users for an admin with a create button', async () => {
    usersApi.list.mockResolvedValue({ items: [MANAGER, EMPLOYEE], total: 2 })
    renderPage('admin')
    expect(await screen.findByText('Mia Manager')).toBeInTheDocument()
    expect(screen.getByText('Eve Employee')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new user/i })).toBeInTheDocument()
  })

  it('hides the create button for managers', async () => {
    usersApi.list.mockResolvedValue({ items: [EMPLOYEE], total: 1 })
    renderPage('manager')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new user/i })).not.toBeInTheDocument()
  })

  it('shows the empty state and the error state', async () => {
    usersApi.list.mockResolvedValue({ items: [], total: 0 })
    const { unmount } = renderPage('admin')
    expect(await screen.findByText('No users yet.')).toBeInTheDocument()
    unmount()

    usersApi.list.mockRejectedValue(new Error('Could not reach the server'))
    renderPage('admin')
    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('navigates to the detail page on row click', async () => {
    usersApi.list.mockResolvedValue({ items: [EMPLOYEE], total: 1 })
    renderPage('admin')
    await userEvent.setup().click(await screen.findByText('Eve Employee'))
    expect(screen.getByText('detail page')).toBeInTheDocument()
  })

  it('creates an employee through the dialog', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue({ items: [MANAGER], total: 1 })
    usersApi.create.mockResolvedValue({ ...EMPLOYEE, id: 'NEW001' })
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: /new user/i }))

    const dialog = screen.getByRole('dialog')
    const type = (label, text) => user.type(within(dialog).getByLabelText(label, { selector: 'input' }), text)
    await type(/first name/i, 'Eve')
    await type(/last name/i, 'Employee')
    await type(/^email/i, 'eve@x.com')
    await type(/^username/i, 'Eve.E')
    await type(/temporary password/i, 'Password1!')
    await type(/job title/i, 'Engineer')
    await type(/annual salary/i, '80000')
    await user.click(within(dialog).getByRole('combobox', { name: /manager/i }))
    await user.click(await screen.findByRole('option', { name: 'Mia Manager' }))
    await user.click(within(dialog).getByRole('button', { name: /create user/i }))

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledTimes(1))
    expect(usersApi.create.mock.calls[0][0]).toEqual({
      username: 'eve.e',
      password: 'Password1!',
      firstName: 'Eve',
      lastName: 'Employee',
      email: 'eve@x.com',
      jobTitle: 'Engineer',
      salary: 80000,
      role: 'employee',
      managerId: 'MGR001',
    })
    expect(await screen.findByText('Created Eve Employee')).toBeInTheDocument()
    expect(usersApi.list).toHaveBeenCalledTimes(2) // refetched
  })

  it('shows client-side validation errors before calling the API', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue({ items: [MANAGER], total: 1 })
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /create user/i }))
    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Employees need a manager')).toBeInTheDocument()
    expect(usersApi.create).not.toHaveBeenCalled()
  })
})
