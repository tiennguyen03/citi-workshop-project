import { createContext } from 'react'

/**
 * Shape: { status: 'loading' | 'anon' | 'authed', user, login(username, password), logout(), updateUser(user) }
 */
export const AuthContext = createContext(null)
