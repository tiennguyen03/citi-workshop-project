import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext.js'
import LoginPage from './LoginPage.jsx'

function renderLogin(login, status = 'anon') {
  render(
    <AuthContext.Provider value={{ status, user: null, login, logout: vi.fn(), updateUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('LoginPage', () => {
  it('disables submit until both fields are filled', async () => {
    const user = userEvent.setup()
    renderLogin(vi.fn())
    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/username/i, { selector: 'input' }), 'admin')
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'pw')
    expect(button).toBeEnabled()
  })

  it('calls login with trimmed username and navigates on success', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockResolvedValue({ role: 'admin' })
    renderLogin(login)
    await user.type(screen.getByLabelText(/username/i, { selector: 'input' }), '  admin ')
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'Admin123!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(login).toHaveBeenCalledWith('admin', 'Admin123!')
    await waitFor(() => expect(screen.getByText('dashboard')).toBeInTheDocument())
  })

  it('shows the API message on 401 and re-enables the form', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(Object.assign(new Error('Invalid username or password'), { status: 401 }))
    renderLogin(login)
    await user.type(screen.getByLabelText(/username/i, { selector: 'input' }), 'admin')
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled()
  })

  it('shows the server message for other errors', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(Object.assign(new Error('Could not reach the server'), { status: 0 }))
    renderLogin(login)
    await user.type(screen.getByLabelText(/username/i, { selector: 'input' }), 'admin')
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'pw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('redirects away when already signed in', () => {
    renderLogin(vi.fn(), 'authed')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})
