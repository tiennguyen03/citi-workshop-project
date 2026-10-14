import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import AddIcon from '@mui/icons-material/Add'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as dashboardApi from '../../services/dashboard.js'
import { greeting } from '../../utils/format.js'
import { ROLES } from '../../utils/roles.js'
import AdminDashboard from './AdminDashboard.jsx'
import EmployeeDashboard from './EmployeeDashboard.jsx'
import ManagerDashboard from './ManagerDashboard.jsx'

/** Role-aware landing page: one read of GET /dashboard, then the matching layout. */
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notice, notify, clear } = useNotice()
  const { data, loading, error, refetch } = useApi(() => dashboardApi.get(), [user.id])

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.firstName}`}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        actions={
          user.role === ROLES.ADMIN ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => navigate('/users')}>
                Users
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/projects/new')}>
                New project
              </Button>
            </Stack>
          ) : undefined
        }
      />
      <ErrorAlert error={error} onRetry={refetch} />
      {loading && !data && (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={220} />
        </Stack>
      )}
      {data?.role === 'admin' && <AdminDashboard data={data} />}
      {data?.role === 'manager' && <ManagerDashboard data={data} />}
      {data?.role === 'employee' && <EmployeeDashboard data={data} onChanged={refetch} notify={notify} />}
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
