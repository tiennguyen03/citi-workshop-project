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
const SUMMARY = { admins: 0, managers: 1, employees: 1, available: 1 }
const pageOf = (items, extra = {}) => ({ items, total: items.length, limit: 25, offset: 0, summary: SUMMARY, ...extra })
const lastQuery = () => usersApi.list.mock.calls.at(-1)[0]

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

  it('lists one page for an admin, with the office counts and the manager column', async () => {
    usersApi.list.mockResolvedValue(pageOf([MANAGER, EMPLOYEE]))
    renderPage('admin')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.getByText('2 people: 1 manager, 1 employee, 1 available')).toBeInTheDocument()
    expect(screen.getAllByText('Mia Manager')).toHaveLength(2) // her own row + Eve's Manager column
    expect(screen.getByRole('columnheader', { name: 'Manager' })).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new user/i })).toBeInTheDocument()
    expect(usersApi.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, offset: 0 }))
  })

  it('hides the create button and the manager column for managers', async () => {
    usersApi.list.mockResolvedValue(pageOf([EMPLOYEE], { summary: null }))
    renderPage('manager')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new user/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Manager' })).not.toBeInTheDocument()
  })

  it('sends filters and search to the API and keeps them in the URL', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue(pageOf([MANAGER, EMPLOYEE]))
    renderPage('admin')
    await screen.findByText('Eve Employee')
    await user.click(screen.getByLabelText(/show deactivated/i))
    await waitFor(() => expect(lastQuery()).toEqual(expect.objectContaining({ inactive: 'true', offset: 0 })))
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'old@')
    await waitFor(() => expect(lastQuery()).toEqual(expect.objectContaining({ q: 'old@', inactive: 'true' })))
    expect(screen.getByText('2 people match')).toBeInTheDocument()
  })

  it('reads ?available=true and the page from the URL', async () => {
    usersApi.list.mockResolvedValue(pageOf([EMPLOYEE], { total: 30, offset: 25 }))
    renderPage('admin', '/users?available=true&page=2')
    expect(await screen.findByText('Eve Employee')).toBeInTheDocument()
    expect(usersApi.list).toHaveBeenCalledWith(expect.objectContaining({ available: 'true', limit: 25, offset: 25 }))
    expect(screen.getByLabelText(/available only/i)).toBeChecked()
    expect(screen.getByText('26–30 of 30')).toBeInTheDocument()
  })

  it('pages with the footer', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue(pageOf([MANAGER, EMPLOYEE], { total: 40 }))
    renderPage('admin')
    expect(await screen.findByText('1–25 of 40')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => expect(lastQuery()).toEqual(expect.objectContaining({ offset: 25 })))
  })

  it('shows the empty state and the error state', async () => {
    usersApi.list.mockResolvedValue(pageOf([]))
    const { unmount } = renderPage('admin')
    expect(await screen.findByText('No users yet.')).toBeInTheDocument()
    unmount()

    usersApi.list.mockRejectedValue(new Error('Could not reach the server'))
    renderPage('admin')
    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('navigates to the detail page on row click', async () => {
    usersApi.list.mockResolvedValue(pageOf([EMPLOYEE]))
    renderPage('admin')
    await userEvent.setup().click(await screen.findByText('Eve Employee'))
    expect(screen.getByText('detail page')).toBeInTheDocument()
  })

  it('creates an employee through the dialog', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue(pageOf([MANAGER]))
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
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(3)) // page + managers, then the page again
  })

  it('shows client-side validation errors before calling the API', async () => {
    const user = userEvent.setup()
    usersApi.list.mockResolvedValue(pageOf([MANAGER]))
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /create user/i }))
    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Employees need a manager')).toBeInTheDocument()
    expect(usersApi.create).not.toHaveBeenCalled()
  })
})
