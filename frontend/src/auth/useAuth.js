import { useContext } from 'react'
import { AuthContext } from './authContext.js'

/** Access the current session. Must be used inside <AuthProvider>. */
export default function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
