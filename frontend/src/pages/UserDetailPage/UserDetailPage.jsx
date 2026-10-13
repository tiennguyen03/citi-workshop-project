import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import UserEditForm from '../../components/UserEditForm/UserEditForm.jsx'
import useApi from '../../hooks/useApi.js'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as usersApi from '../../services/users.js'
import { ROLES, fullName } from '../../utils/roles.js'
import { formatMoney } from '../../utils/format.js'

function Field({ label, value }) {
  return (
    <Box sx={{ minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value ?? '—'}</Typography>
    </Box>
  )
}
Field.propTypes = { label: PropTypes.node.isRequired, value: PropTypes.node }

/** View (and, per role, edit) a single user (ui-flow.md F9 / users). */
export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me, updateUser } = useAuth()
  const { notice, notify, clear } = useNotice()
  const isAdmin = me.role === ROLES.ADMIN

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
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1 }}>
        Back
      </Button>
      <ErrorAlert error={error} onRetry={refetch} />
      {loading && <Skeleton variant="rounded" height={180} />}
      {user && (
        <>
          <PageHeader
            title={fullName(user)}
            subtitle={user.jobTitle}
            actions={
              <Stack direction="row" spacing={1}>
                <RoleChip role={user.role} size="medium" />
                {user.isActive === false && <Chip label="Deactivated" />}
              </Stack>
            }
          />
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" useFlexGap spacing={3} sx={{ flexWrap: "wrap" }}>
              <Field label="User ID" value={user.id} />
              {user.username && <Field label="Username" value={user.username} />}
              <Field label="Email" value={user.email} />
              {'salary' in user && <Field label="Annual salary" value={formatMoney(user.salary)} />}
              {user.role === ROLES.EMPLOYEE && (
                <Field label="Current project" value={user.currentProject ? user.currentProject.name : 'Available'} />
              )}
            </Stack>
          </Paper>
          {canEditNameEmail && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Edit details
              </Typography>
              <Divider sx={{ mb: 2 }} />
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
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
