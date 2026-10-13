import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FieldList from '../../components/FieldList/FieldList.jsx'
import NoticeSnackbar from '../../components/NoticeSnackbar/NoticeSnackbar.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import UserEditForm from '../../components/UserEditForm/UserEditForm.jsx'
import useNotice from '../../hooks/useNotice.js'
import useAuth from '../../auth/useAuth.js'
import * as usersApi from '../../services/users.js'
import { fullName } from '../../utils/roles.js'
import { formatMoney } from '../../utils/format.js'
import PasswordForm from './PasswordForm.jsx'

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
        <FieldList
          items={[
            { label: 'User ID', value: user.id },
            { label: 'Username', value: user.username },
            { label: 'Job title', value: user.jobTitle },
            { label: 'Annual salary', value: formatMoney(user.salary) },
          ]}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Job title, salary and role are managed by an admin.
        </Typography>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Contact details
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <UserEditForm key={user.email} user={user} canEditNameEmail onSave={save} />
      </Paper>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Replace the temporary password your admin gave you, or change it any time.
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <PasswordForm onChanged={() => notify('Password changed')} />
      </Paper>
      <NoticeSnackbar notice={notice} onClose={clear} />
    </>
  )
}
