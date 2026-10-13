import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import * as authApi from '../../services/auth.js'
import ProfilePage from './ProfilePage.jsx'

vi.mock('../../services/auth.js')

const ME = { id: 'EMP001', username: 'eve', firstName: 'Eve', lastName: 'Employee', email: 'eve@x.com', jobTitle: 'Engineer', salary: 90000, role: 'employee' }

function renderPage() {
  render(
    <AuthContext.Provider value={{ status: 'authed', user: ME, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const type = async (user, label, text) => user.type(screen.getByLabelText(label, { selector: 'input' }), text)

describe('ProfilePage password change', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('validates before calling the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await type(user, /current password/i, 'Password1!')
    await type(user, /^new password/i, 'short')
    await type(user, /confirm new password/i, 'different')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('changes the password and clears the form', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockResolvedValue({ changed: true })
    renderPage()
    await type(user, /current password/i, 'Password1!')
    await type(user, /^new password/i, 'Brand-new-1')
    await type(user, /confirm new password/i, 'Brand-new-1')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    await waitFor(() => expect(authApi.changePassword).toHaveBeenCalledWith({ currentPassword: 'Password1!', newPassword: 'Brand-new-1' }))
    expect(await screen.findByText('Password changed')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i, { selector: 'input' })).toHaveValue('')
  })

  it('shows the server message when the current password is wrong', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockRejectedValue(Object.assign(new Error('Current password is incorrect'), { status: 400, details: { field: 'currentPassword' } }))
    renderPage()
    await type(user, /current password/i, 'wrong')
    await type(user, /^new password/i, 'Brand-new-1')
    await type(user, /confirm new password/i, 'Brand-new-1')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
  })
})
