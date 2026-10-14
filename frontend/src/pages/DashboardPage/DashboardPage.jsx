import { useState } from 'react'
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
import * as usersApi from '../../services/users.js'
import { greeting } from '../../utils/format.js'
import { ROLES } from '../../utils/roles.js'
import ProjectDialog from '../ProjectsPage/ProjectDialog.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import EmployeeDashboard from './EmployeeDashboard.jsx'
import ManagerDashboard from './ManagerDashboard.jsx'

/** Role-aware landing page: one read of GET /dashboard, then the matching layout. */
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notice, notify, clear } = useNotice()
  const { data, loading, error, refetch } = useApi(() => dashboardApi.get(), [user.id])
  const isAdmin = user.role === ROLES.ADMIN
  const [creating, setCreating] = useState(false)
  const { data: managersData } = useApi(() => (isAdmin ? usersApi.list({ role: ROLES.MANAGER }) : Promise.resolve(null)), [isAdmin])
  const managers = (managersData?.items ?? []).filter((m) => m.isActive !== false)

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
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
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
      {isAdmin && (
        <ProjectDialog
          key={`new-${creating}`}
          open={creating}
          isAdmin
          managers={managers}
          onClose={() => setCreating(false)}
          onSaved={(created) => navigate(`/projects/${created.id}`)}
        />
      )}
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
