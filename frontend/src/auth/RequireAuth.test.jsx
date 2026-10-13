import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from './authContext.js'
import RequireAuth from './RequireAuth.jsx'
import RequireRole from './RequireRole.jsx'

function renderWith(auth, initialPath = '/secret') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/403" element={<p>forbidden page</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/secret" element={<p>secret content</p>} />
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/admin-only" element={<p>admin content</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth / RequireRole', () => {
  it('shows a loader while the session is being restored', () => {
    renderWith({ status: 'loading', user: null })
    expect(screen.getByLabelText('Loading session')).toBeInTheDocument()
  })

  it('redirects anonymous users to /login', () => {
    renderWith({ status: 'anon', user: null })
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders protected content for signed-in users', () => {
    renderWith({ status: 'authed', user: { role: 'employee' } })
    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('sends the wrong role to /403', () => {
    renderWith({ status: 'authed', user: { role: 'employee' } }, '/admin-only')
    expect(screen.getByText('forbidden page')).toBeInTheDocument()
  })

  it('lets the right role through', () => {
    renderWith({ status: 'authed', user: { role: 'admin' } }, '/admin-only')
    expect(screen.getByText('admin content')).toBeInTheDocument()
  })
})
