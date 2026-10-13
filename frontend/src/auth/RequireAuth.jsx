import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import useAuth from './useAuth.js'

/** Layout route: renders children only for a signed-in user; otherwise redirects to /login. */
export default function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress aria-label="Loading session" />
      </Box>
    )
  }
  if (status !== 'authed') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
