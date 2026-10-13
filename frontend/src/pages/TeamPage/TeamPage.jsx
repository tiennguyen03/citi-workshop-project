import { useNavigate } from 'react-router-dom'
import Avatar from '@mui/material/Avatar'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import useAuth from '../../auth/useAuth.js'
import * as usersApi from '../../services/users.js'
import { ROLES, fullName, initials } from '../../utils/roles.js'

const COLUMNS = [
  { key: 'name', label: 'Name', render: (u) => fullName(u) },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'email', label: 'Email' },
  {
    key: 'currentProject',
    label: 'Current project',
    render: (u) => (u.currentProject ? u.currentProject.name : <Tag label="Available" tone="success" />),
  },
]

/** Immediate team: my manager and the people who share them (manager + employee views). */
export default function TeamPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useApi(() => usersApi.team(me.id), [me.id])
  const isManager = me.role === ROLES.MANAGER

  return (
    <>
      <PageHeader title="My team" subtitle={isManager ? 'Your direct reports' : 'People who share your manager'} />
      <ErrorAlert error={error} onRetry={refetch} />
      {data?.manager && !isManager && (
        <Paper sx={{ p: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'action.selected', color: 'text.primary' }}>{initials(data.manager)}</Avatar>
          <Stack>
            <Typography variant="overline" color="text.secondary">
              Your manager
            </Typography>
            <Typography sx={{ fontWeight: 500 }}>
              {fullName(data.manager)} · {data.manager.jobTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.manager.email}
            </Typography>
          </Stack>
        </Paper>
      )}
      <DataTable
        columns={COLUMNS}
        rows={data?.members ?? []}
        getRowKey={(u) => u.id}
        loading={loading}
        emptyMessage={isManager ? 'No one reports to you yet.' : 'No teammates yet.'}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        size="small"
      />
    </>
  )
}
