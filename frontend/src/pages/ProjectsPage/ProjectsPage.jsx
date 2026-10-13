import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import useApi from '../../hooks/useApi.js'
import useAuth from '../../auth/useAuth.js'
import * as projectsApi from '../../services/projects.js'
import { formatDate, formatHours } from '../../utils/format.js'
import { ROLES, fullName } from '../../utils/roles.js'

const COLUMNS = [
  { key: 'name', label: 'Project' },
  { key: 'status', label: 'Status', render: (p) => <StatusChip status={p.status} archived={p.archived} /> },
  { key: 'manager', label: 'Manager', render: (p) => fullName(p.manager) },
  { key: 'dates', label: 'Dates', nowrap: true, render: (p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` },
  { key: 'memberCount', label: 'Team', align: 'right' },
  {
    key: 'hours',
    label: 'Hours completed',
    render: (p) => (
      <ProgressBar value={p.hoursCompleted} max={p.capacityHours} caption={`${formatHours(p.hoursCompleted)} of ${formatHours(p.capacityHours)}`} />
    ),
  },
]

const SUBTITLES = {
  admin: 'All projects',
  manager: 'Projects you manage',
  employee: 'Your current and past projects',
}

/** Role-filtered project list (ui-flow.md F3/F8). */
export default function ProjectsPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const isAdmin = me.role === ROLES.ADMIN
  const [showArchived, setShowArchived] = useState(false)

  const { data, loading, error, refetch } = useApi(
    () => projectsApi.list({ archived: showArchived ? 'true' : undefined }),
    [showArchived],
  )

  return (
    <>
      <PageHeader
        title={me.role === ROLES.EMPLOYEE ? 'My projects' : 'Projects'}
        subtitle={SUBTITLES[me.role]}
        actions={
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {isAdmin && (
              <FormControlLabel
                control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />}
                label="Show archived"
              />
            )}
            {isAdmin && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/projects/new')}>
                New project
              </Button>
            )}
          </Stack>
        }
      />
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={COLUMNS}
        rows={data?.items ?? []}
        getRowKey={(p) => p.id}
        loading={loading}
        emptyMessage={showArchived ? 'No archived projects.' : me.role === ROLES.EMPLOYEE ? 'You are not on a project yet.' : 'No projects yet.'}
        onRowClick={(p) => navigate(`/projects/${p.id}`)}
        size="small"
      />
    </>
  )
}
