import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { AuthContext } from './authContext.js'
import { setAuthToken, setUnauthorizedHandler } from '../services/client.js'
import * as authApi from '../services/auth.js'

const STORAGE_KEY = 'projectTracker.token'

function readStoredToken() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token) {
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — session simply won't persist */
  }
}

/**
 * Holds the session (token + current user). On mount, restores a stored token by calling
 * /auth/me; any 401 anywhere in the app logs the user out.
 */
export default function AuthProvider({ children }) {
  const [state, setState] = useState(() => {
    const stored = readStoredToken()
    if (stored) setAuthToken(stored)
    return { status: stored ? 'loading' : 'anon', user: null }
  })

  const logout = useCallback(() => {
    setAuthToken(null)
    writeStoredToken(null)
    setState({ status: 'anon', user: null })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  useEffect(() => {
    if (state.status !== 'loading') return undefined
    let cancelled = false
    authApi
      .me()
      .then((user) => {
        if (!cancelled) setState({ status: 'authed', user })
      })
      .catch(() => {
        if (!cancelled) logout()
      })
    return () => {
      cancelled = true
    }
  }, [state.status, logout])

  const login = useCallback(async (username, password) => {
    const { token, user } = await authApi.login(username, password)
    setAuthToken(token)
    writeStoredToken(token)
    setState({ status: 'authed', user })
    return user
  }, [])

  const updateUser = useCallback((user) => setState((prev) => ({ ...prev, user })), [])

  const value = useMemo(
    () => ({ ...state, login, logout, updateUser }),
    [state, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node,
}
