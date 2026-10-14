import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import ListToolbar from '../../components/ListToolbar/ListToolbar.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import useUrlFilters from '../../hooks/useUrlFilters.js'
import * as usersApi from '../../services/users.js'
import { filterUsers } from '../../utils/listFilters.js'
import { ROLES, ROLE_LABELS, fullName } from '../../utils/roles.js'
import UserCreateDialog from './UserCreateDialog.jsx'

const FILTER_DEFAULTS = { q: '', role: '', available: '', inactive: '' }

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
    render: (u) => (u.isActive === false ? <Tag label="Deactivated" tone="warning" /> : <Tag label="Active" tone="neutral" dot />),
  },
]

/** Admin: all users + create. Manager: own direct reports. */
export default function UsersPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const { notice, notify, clear } = useNotice()
  const [createOpen, setCreateOpen] = useState(false)
  const isAdmin = me.role === ROLES.ADMIN
  const { filters, setFilter, isFiltered } = useUrlFilters(FILTER_DEFAULTS)

  const { data, loading, error, refetch } = useApi(() => usersApi.list(), [])
  const items = data?.items ?? []
  const rows = filterUsers(items, filters)
  const managers = items.filter((u) => u.role === ROLES.MANAGER && u.isActive !== false)
  const total = data?.total ?? '…'

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Users' : 'My team'}
        subtitle={isAdmin ? (isFiltered && data ? `${rows.length} of ${total} users` : `${total} users`) : 'Your direct reports'}
        actions={
          isAdmin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              New user
            </Button>
          ) : null
        }
      />
      <ListToolbar search={filters.q} onSearchChange={(q) => setFilter('q', q)} placeholder="Name, email or username">
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
        columns={COLUMNS}
        rows={rows}
        getRowKey={(u) => u.id}
        loading={loading}
        emptyMessage={isFiltered && items.length > 0 ? 'No one matches your filters.' : 'No users yet.'}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        size="small"
      />
      {isAdmin && (
        <UserCreateDialog
          open={createOpen}
          managers={managers}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false)
            notify(`Created ${fullName(created)}`)
            refetch()
          }}
        />
      )}
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
