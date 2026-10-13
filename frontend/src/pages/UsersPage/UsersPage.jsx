import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as usersApi from '../../services/users.js'
import { ROLES, fullName } from '../../utils/roles.js'
import UserCreateDialog from './UserCreateDialog.jsx'

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

  const { data, loading, error, refetch } = useApi(() => usersApi.list(), [])
  const rows = data?.items ?? []
  const managers = rows.filter((u) => u.role === ROLES.MANAGER && u.isActive !== false)

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Users' : 'My team'}
        subtitle={isAdmin ? `${data?.total ?? '…'} users` : 'Your direct reports'}
        actions={
          isAdmin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              New user
            </Button>
          ) : null
        }
      />
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(u) => u.id}
        loading={loading}
        emptyMessage="No users yet."
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
