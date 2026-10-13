import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import useAuth from '../../auth/useAuth.js'
import { ROLE_LABELS, fullName } from '../../utils/roles.js'

/** Role-aware landing page. Content per role arrives in slice 5 (ui-flow.md). */
export default function DashboardPage() {
  const { user } = useAuth()
  return (
    <>
      <PageHeader title={`Welcome, ${fullName(user)}`} subtitle={`Signed in as ${ROLE_LABELS[user.role]}`} />
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Your dashboard will appear here.</Typography>
      </Paper>
    </>
  )
}
