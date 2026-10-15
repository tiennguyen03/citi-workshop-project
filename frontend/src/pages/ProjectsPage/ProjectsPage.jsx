import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../components/DataTable/paging.js'
import DueTag from '../../components/DueTag/DueTag.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import ListToolbar from '../../components/ListToolbar/ListToolbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import useApi from '../../hooks/useApi.js'
import useAuth from '../../auth/useAuth.js'
import useDebouncedValue from '../../hooks/useDebouncedValue.js'
import useUrlFilters from '../../hooks/useUrlFilters.js'
import * as projectsApi from '../../services/projects.js'
import * as usersApi from '../../services/users.js'
import { formatDate, formatRatio } from '../../utils/format.js'
import { ROLES, fullName } from '../../utils/roles.js'
import ProjectDialog from './ProjectDialog.jsx'

/** Filters, the page and the page size live in the URL (`/projects?status=active&page=2`); the API does the searching and paging. */
const FILTER_DEFAULTS = { q: '', status: '', archived: '', page: '1', size: String(PAGE_SIZE) }

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
  { key: 'dates', label: 'Dates', nowrap: true, render: (p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` },
  { key: 'memberCount', label: 'Team', numeric: true },
  {
    key: 'hours',
    label: 'Hours completed',
    render: (p) => (
      <ProgressBar layout="inline" value={p.hoursCompleted} max={p.capacityHours} caption={formatRatio(p.hoursCompleted, p.capacityHours)} />
    ),
  },
]

/** Admins see who runs each project; a manager's list is all their own, so the column would repeat the subtitle (D25). */
const MANAGER_COLUMN = { key: 'manager', label: 'Manager', render: (p) => fullName(p.manager) }

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
  const [creating, setCreating] = useState(false)
  const { filters, setFilters } = useUrlFilters(FILTER_DEFAULTS)
  const page = Math.max(1, Number(filters.page) || 1)
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(filters.size)) ? Number(filters.size) : PAGE_SIZE
  const showArchived = filters.archived === 'true'
  const isFiltered = Boolean(filters.q || filters.status)
  const setFilter = (key, value) => setFilters({ [key]: value, page: '' })
  const { data: managersData } = useApi(() => (isAdmin ? usersApi.list({ role: ROLES.MANAGER, limit: 100 }) : Promise.resolve(null)), [isAdmin])
  const managers = (managersData?.items ?? []).filter((m) => m.isActive !== false)

  const [search, setSearch] = useState(filters.q)
  const debounced = useDebouncedValue(search)
  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced, page: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const { data, loading, error, refetch } = useApi(
    () =>
      projectsApi.list({
        archived: showArchived ? 'true' : undefined,
        status: filters.status || undefined,
        q: filters.q || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    [showArchived, filters.status, filters.q, page, pageSize],
  )
  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const columns = isAdmin ? [COLUMNS[0], COLUMNS[1], MANAGER_COLUMN, ...COLUMNS.slice(2)] : COLUMNS
  const emptyMessage = isFiltered
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
      <ListToolbar search={search} onSearchChange={setSearch} placeholder={isAdmin ? 'Name or manager' : 'Project name'}>
        <TextField select label="Status" size="small" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="complete">Complete</MenuItem>
        </TextField>
        {isAdmin && (
          <FormControlLabel
            control={<Switch checked={showArchived} onChange={(e) => setFilter('archived', e.target.checked ? 'true' : '')} />}
            label="Show archived"
          />
        )}
      </ListToolbar>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => p.id}
        loading={loading}
        emptyMessage={emptyMessage}
        onRowClick={(p) => navigate(`/projects/${p.id}`)}
        size="small"
        pagination={{
          page: page - 1,
          pageSize,
          total,
          onPageChange: (p) => setFilters({ page: String(p + 1) }),
          onPageSizeChange: (size) => setFilters({ size: String(size), page: '' }),
        }}
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
