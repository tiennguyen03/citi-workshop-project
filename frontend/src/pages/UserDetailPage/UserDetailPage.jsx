import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import FieldList from '../../components/FieldList/FieldList.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import UserEditForm from '../../components/UserEditForm/UserEditForm.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as usersApi from '../../services/users.js'
import { ROLES, fullName } from '../../utils/roles.js'
import { formatDate, formatHours, formatMoney } from '../../utils/format.js'
import ResetPasswordDialog from './ResetPasswordDialog.jsx'

/** Every project the person has been on (api-contract.md › MembershipHistory), same labels as the project's Members tab. */
const HISTORY_COLUMNS = [
  { key: 'name', label: 'Project' },
  { key: 'status', label: 'Status', render: (p) => <StatusChip status={p.status} archived={p.archived} /> },
  { key: 'hoursAssigned', label: 'Assigned', align: 'right', render: (p) => formatHours(p.hoursAssigned) },
  {
    key: 'hoursCompleted',
    label: 'Completed',
    render: (p) => <ProgressBar value={p.hoursCompleted} max={p.hoursAssigned} caption={`${formatHours(p.hoursCompleted)} of ${formatHours(p.hoursAssigned)}`} />,
  },
  {
    key: 'isActive',
    label: 'Membership',
    render: (p) => (p.isActive ? <Tag label="Active" tone="success" dot /> : <Tag label={`Released (${p.releasedReason})`} tone="neutral" />),
  },
  { key: 'addedAt', label: 'Joined', nowrap: true, render: (p) => formatDate(p.addedAt) },
  { key: 'releasedAt', label: 'Released', nowrap: true, render: (p) => formatDate(p.releasedAt) },
]

/** View (and, per role, edit) a single user (ui-flow.md F9 / users). */
export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me, updateUser } = useAuth()
  const { notice, notify, clear } = useNotice()
  const isAdmin = me.role === ROLES.ADMIN
  const [resetOpen, setResetOpen] = useState(false)

  const { data: user, loading, error, refetch } = useApi(() => usersApi.get(id), [id])
  const { data: managersData } = useApi(() => (isAdmin ? usersApi.list({ role: ROLES.MANAGER }) : Promise.resolve(null)), [isAdmin])
  const managers = (managersData?.items ?? []).filter((m) => m.isActive !== false)

  const isSelf = user?.id === me.id
  const isMyReport = me.role === ROLES.MANAGER && user?.managerId === me.id
  const canEditNameEmail = isAdmin || isSelf || isMyReport

  async function save(changes) {
    const updated = await usersApi.update(id, changes)
    if (isSelf) updateUser({ ...me, ...updated })
    notify('Changes saved')
    refetch()
  }

  return (
    <>
      <ErrorAlert error={error} onRetry={refetch} />
      {loading && <Skeleton variant="rounded" height={180} />}
      {user && (
        <>
          <PageHeader
            back={isAdmin ? { label: 'All users', to: '/users' } : { label: 'My team', to: me.role === ROLES.MANAGER ? '/users' : '/team' }}
            title={fullName(user)}
            subtitle={user.jobTitle}
            actions={
              <Stack direction="row" spacing={1}>
                <RoleChip role={user.role} size="medium" />
                {isAdmin && (
                  <Button variant="outlined" onClick={() => navigate(`/audit-log?actorId=${user.id}`)}>
                    View activity
                  </Button>
                )}
                {isAdmin && !isSelf && (
                  <Button variant="outlined" onClick={() => setResetOpen(true)}>
                    Reset password
                  </Button>
                )}
                {user.isActive === false && <Tag label="Deactivated" tone="warning" size="medium" />}
              </Stack>
            }
          />
          <Paper sx={{ p: 3, mb: 3 }}>
            <FieldList
              items={[
                { label: 'User ID', value: <Box component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.875rem' }}>{user.id}</Box> },
                ...(user.username ? [{ label: 'Username', value: user.username }] : []),
                { label: 'Email', value: user.email },
                ...('salary' in user ? [{ label: 'Annual salary', value: formatMoney(user.salary) }] : []),
                ...(user.role === ROLES.EMPLOYEE
                  ? [
                      {
                        label: 'Reports to',
                        value: user.manager ? (
                          <Link component={RouterLink} to={`/users/${user.manager.id}`} underline="hover">
                            {fullName(user.manager)}
                          </Link>
                        ) : (
                          '—'
                        ),
                      },
                      { label: 'Current project', value: user.currentProject ? user.currentProject.name : <Tag label="Available" tone="success" /> },
                    ]
                  : []),
              ]}
            />
          </Paper>
          {user.role === ROLES.EMPLOYEE && Array.isArray(user.projects) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                Projects
              </Typography>
              <DataTable
                columns={HISTORY_COLUMNS}
                rows={user.projects}
                getRowKey={(p) => p.id}
                emptyMessage="Not on any project yet."
                onRowClick={(p) => navigate(`/projects/${p.id}`)}
                size="small"
              />
            </Box>
          )}
          {canEditNameEmail && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Edit details
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <UserEditForm
                key={user.id + String(user.isActive)}
                user={user}
                canEditNameEmail={canEditNameEmail}
                isAdmin={isAdmin}
                managers={managers}
                onSave={save}
              />
            </Paper>
          )}
        </>
      )}
      {user && isAdmin && !isSelf && (
        <ResetPasswordDialog
          key={`reset-${resetOpen}`}
          open={resetOpen}
          user={user}
          onClose={() => setResetOpen(false)}
          onDone={() => {
            setResetOpen(false)
            notify(`Temporary password set for ${fullName(user)}`)
          }}
        />
      )}
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
