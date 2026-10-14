import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import ListToolbar from '../../components/ListToolbar/ListToolbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import useApi from '../../hooks/useApi.js'
import useAuth from '../../auth/useAuth.js'
import useUrlFilters from '../../hooks/useUrlFilters.js'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import { formatDate, formatHours } from '../../utils/format.js'
import { filterProjects } from '../../utils/listFilters.js'
import { ROLES, fullName } from '../../utils/roles.js'
import ProjectDialog from './ProjectDialog.jsx'

const FILTER_DEFAULTS = { q: '', status: '' }

const COLUMNS = [
  { key: 'name', label: 'Project' },
  {
    key: 'status',
    label: 'Status',
    render: (p) => (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <StatusChip status={p.status} archived={p.archived} />
        <DueTag dueDate={p.endDate} isOpen={p.status === 'active' && !p.archived} soonDays={null} overdueLabel="Past end date" overdueTone="warning" />
      </Stack>
    ),
  },
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
  const [creating, setCreating] = useState(false)
  const { filters, setFilter, isFiltered } = useUrlFilters(FILTER_DEFAULTS)
  const { data: managersData } = useApi(() => (isAdmin ? usersApi.list({ role: ROLES.MANAGER }) : Promise.resolve(null)), [isAdmin])
  const managers = (managersData?.items ?? []).filter((m) => m.isActive !== false)

  const { data, loading, error, refetch } = useApi(
    () => projectsApi.list({ archived: showArchived ? 'true' : undefined }),
    [showArchived],
  )
  const items = data?.items ?? []
  const rows = filterProjects(items, filters)
  const emptyMessage =
    isFiltered && items.length > 0
      ? 'No projects match your filters.'
      : showArchived
        ? 'No archived projects.'
        : me.role === ROLES.EMPLOYEE
          ? 'You are not on a project yet.'
          : 'No projects yet.'

  return (
    <>
      <PageHeader
        title={me.role === ROLES.EMPLOYEE ? 'My projects' : 'Projects'}
        subtitle={SUBTITLES[me.role]}
        actions={
          isAdmin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              New project
            </Button>
          ) : null
        }
      />
      <ListToolbar search={filters.q} onSearchChange={(q) => setFilter('q', q)} placeholder="Name or manager">
        <TextField select label="Status" size="small" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="complete">Complete</MenuItem>
        </TextField>
        {isAdmin && (
          <FormControlLabel
            control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />}
            label="Show archived"
          />
        )}
      </ListToolbar>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(p) => p.id}
        loading={loading}
        emptyMessage={emptyMessage}
        onRowClick={(p) => navigate(`/projects/${p.id}`)}
        size="small"
      />
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
    </>
  )
}
