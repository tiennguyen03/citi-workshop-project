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
  managerId: 'MGR001',
  currentProject: null,
}

const RETIRED = { ...EMPLOYEE, id: 'EMP009', firstName: 'Old', lastName: 'Timer', email: 'old@x.com', isActive: false }
const BUSY = { ...EMPLOYEE, id: 'EMP002', firstName: 'Max', lastName: 'New', email: 'max@x.com', currentProject: { id: 'PRJ001', name: 'Decommission' } }

function renderPage(role = 'admin', url = '/users') {
  return render(
    <AuthContext.Provider value={{ status: 'authed', user: { id: 'ME0001', role }, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
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
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.getByText('2 people: 1 manager, 1 employee, 1 available')).toBeInTheDocument()
    expect(screen.getAllByText('Mia Manager')).toHaveLength(2) // her own row + Eve's Manager column
    expect(screen.getByRole('columnheader', { name: 'Manager' })).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new user/i })).toBeInTheDocument()
  })

  it('hides the create button for managers', async () => {
    usersApi.list.mockResolvedValue({ items: [EMPLOYEE], total: 1 })
    renderPage('manager')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new user/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Manager' })).not.toBeInTheDocument()
  })

  it('hides deactivated accounts until asked, and searches by email', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue({ items: [MANAGER, EMPLOYEE, RETIRED], total: 3 })
    renderPage('admin')
    await screen.findByText('Eve Employee')
    expect(screen.queryByText('Old Timer')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText(/show deactivated/i))
    expect(await screen.findByText('Old Timer')).toBeInTheDocument()
    expect(screen.getByText('3 of 3 users')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'old@')
    expect(screen.queryByText('Eve Employee')).not.toBeInTheDocument()
    expect(screen.getByText('Old Timer')).toBeInTheDocument()
  })

  it('shows only free employees when linked with ?available=true', async () => {
    usersApi.list.mockResolvedValue({ items: [MANAGER, EMPLOYEE, BUSY], total: 3 })
    renderPage('admin', '/users?available=true')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.queryByText('Max New')).not.toBeInTheDocument()
    expect(screen.queryByText('mia@x.com')).not.toBeInTheDocument() // the manager's own row is gone; her name still shows in Eve's Manager column
    expect(screen.getByLabelText(/available only/i)).toBeChecked()
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
