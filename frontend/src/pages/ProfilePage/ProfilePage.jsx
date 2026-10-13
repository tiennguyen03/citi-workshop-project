import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import UserEditForm from '../../components/UserEditForm/UserEditForm.jsx'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as usersApi from '../../services/users.js'
import { fullName } from '../../utils/roles.js'
import { formatMoney } from '../../utils/format.js'

function ReadOnly({ label, value }) {
  return (
    <Box sx={{ minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value ?? '—'}</Typography>
    </Box>
  )
}
ReadOnly.propTypes = { label: PropTypes.node.isRequired, value: PropTypes.node }

/** The signed-in user's own profile: name + email editable, everything else read-only (F10). */
export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { notice, notify, clear } = useNotice()

  async function save(changes) {
    const updated = await usersApi.update(user.id, changes)
    updateUser({ ...user, ...updated })
    notify('Profile updated')
  }

  return (
    <>
      <PageHeader title="My profile" subtitle={fullName(user)} actions={<RoleChip role={user.role} size="medium" />} />
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" useFlexGap spacing={3} sx={{ flexWrap: "wrap" }}>
          <ReadOnly label="User ID" value={user.id} />
          <ReadOnly label="Username" value={user.username} />
          <ReadOnly label="Job title" value={user.jobTitle} />
          <ReadOnly label="Annual salary" value={formatMoney(user.salary)} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Job title, salary and role are managed by an admin.
        </Typography>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Contact details
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <UserEditForm key={user.email} user={user} canEditNameEmail onSave={save} />
      </Paper>
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
