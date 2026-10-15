import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import DataTable from '../../components/DataTable/DataTable.jsx'
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../components/DataTable/paging.js'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import ListToolbar from '../../components/ListToolbar/ListToolbar.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import useDebouncedValue from '../../hooks/useDebouncedValue.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import useUrlFilters from '../../hooks/useUrlFilters.js'
import * as usersApi from '../../services/users.js'
import { ROLES, ROLE_LABELS, fullName } from '../../utils/roles.js'
import UserCreateDialog from './UserCreateDialog.jsx'
import UserImportDialog from './UserImportDialog.jsx'

/** Filters, the page and the page size live in the URL, so a filtered page is a link (`/users?available=true&page=2`). */
const FILTER_DEFAULTS = { q: '', role: '', available: '', inactive: '', page: '1', size: String(PAGE_SIZE) }

const COLUMNS = [
  { key: 'name', label: 'Name', nowrap: true, render: (u) => fullName(u) },
  { key: 'role', label: 'Role', render: (u) => <RoleChip role={u.role} /> },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'email', label: 'Email' },
  {
    key: 'currentProject',
    label: 'Current project',
    render: (u) =>
      u.role !== ROLES.EMPLOYEE ? '—' : u.currentProject ? u.currentProject.name : <Tag label="Available" tone="success" />,
  },
  {
    key: 'isActive',
    label: 'Status',
    render: (u) => (u.isActive === false ? <Tag label="Deactivated" tone="warning" /> : <Tag label="Active" tone="neutral" variant="quiet" />),
  },
]

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "16 people: 1 admin, 3 managers, 12 employees, 4 available" from the API's office-wide counts. */
function peopleLine(summary) {
  const parts = [[summary.admins, 'admin'], [summary.managers, 'manager'], [summary.employees, 'employee']]
    .filter(([n]) => n > 0)
    .map(([n, word]) => plural(n, word))
  if (summary.available > 0) parts.push(`${summary.available} available`)
  const total = summary.admins + summary.managers + summary.employees
  return `${total === 1 ? '1 person' : `${total} people`}: ${parts.join(', ')}`
}

/** Admin: everyone, searchable and paged by the API. Manager: own direct reports, same controls. */
export default function UsersPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const { notice, notify, clear } = useNotice()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const isAdmin = me.role === ROLES.ADMIN
  const { filters, setFilters } = useUrlFilters(FILTER_DEFAULTS)
  const page = Math.max(1, Number(filters.page) || 1)
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(filters.size)) ? Number(filters.size) : PAGE_SIZE
  const isFiltered = Boolean(filters.q || filters.role || filters.available || filters.inactive)

  // the search box is typed into locally and reaches the URL (and the API) once typing pauses
  const [search, setSearch] = useState(filters.q)
  const debounced = useDebouncedValue(search)
  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced, page: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const { data, loading, error, refetch } = useApi(
    () =>
      usersApi.list({
        q: filters.q || undefined,
        role: filters.role || undefined,
        available: filters.available || undefined,
        inactive: filters.inactive || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    [filters.q, filters.role, filters.available, filters.inactive, page, pageSize],
  )
  // managers by name: the Manager column and the create dialog need them even when they are not on this page
  const { data: managersData, refetch: refetchManagers } = useApi(() => (isAdmin ? usersApi.list({ role: ROLES.MANAGER, limit: 100 }) : Promise.resolve(null)), [isAdmin])
  const reload = () => {
    refetch()
    refetchManagers() // a new manager must show up in the Manager column and the create dialog
  }
  const managers = (managersData?.items ?? []).filter((u) => u.isActive !== false)
  const managerById = new Map((managersData?.items ?? []).map((u) => [u.id, u]))

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const managerColumn = {
    key: 'manager',
    label: 'Manager',
    nowrap: true,
    render: (u) => (u.role === ROLES.EMPLOYEE && managerById.get(u.managerId) ? fullName(managerById.get(u.managerId)) : '—'),
  }
  // Reporting lines matter to the admin who moves people between managers; a manager's list is all their own.
  const columns = isAdmin ? [...COLUMNS.slice(0, 3), managerColumn, ...COLUMNS.slice(3)] : COLUMNS
  const setFilter = (key, value) => setFilters({ [key]: value, page: '' })

  let subtitle = 'Your direct reports'
  if (isAdmin) {
    if (!data) subtitle = '…'
    else if (isFiltered) subtitle = total === 1 ? '1 person matches' : `${total} people match`
    else subtitle = data.summary ? peopleLine(data.summary) : `${total} people`
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Users' : 'My team'}
        subtitle={subtitle}
        actions={
          isAdmin ? (
            <>
              <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                New user
              </Button>
            </>
          ) : null
        }
      />
      <ListToolbar search={search} onSearchChange={setSearch} placeholder="Name, email or username">
        {isAdmin && (
          <TextField select label="Role" size="small" value={filters.role} onChange={(e) => setFilter('role', e.target.value)} sx={{ width: 160 }}>
            <MenuItem value="">All roles</MenuItem>
            {Object.values(ROLES).map((role) => (
              <MenuItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </TextField>
        )}
        <FormControlLabel
          control={<Switch checked={filters.available === 'true'} onChange={(e) => setFilter('available', e.target.checked ? 'true' : '')} />}
          label="Available only"
        />
        <FormControlLabel
          control={<Switch checked={filters.inactive === 'true'} onChange={(e) => setFilter('inactive', e.target.checked ? 'true' : '')} />}
          label="Show deactivated"
        />
      </ListToolbar>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(u) => u.id}
        loading={loading}
        emptyMessage={isFiltered ? 'No one matches your filters.' : 'No users yet.'}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
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
        <UserCreateDialog
          open={createOpen}
          managers={managers}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false)
            notify(`Created ${fullName(created)}`)
            reload()
          }}
        />
      )}
      {isAdmin && (
        <UserImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={(count) => {
            notify(`Created ${count} user${count === 1 ? '' : 's'}`)
            reload()
          }}
        />
      )}
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
