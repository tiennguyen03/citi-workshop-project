import PropTypes from 'prop-types'
import { Navigate, Outlet } from 'react-router-dom'
import useAuth from './useAuth.js'

/** Layout route: only the listed roles may pass; everyone else lands on /403. */
export default function RequireRole({ roles }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }
  return <Outlet />
}

RequireRole.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
}
