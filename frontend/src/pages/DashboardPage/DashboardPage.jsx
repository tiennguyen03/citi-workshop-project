import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import useAuth from '../../auth/useAuth.js'
import { ROLES, ROLE_LABELS } from '../../utils/roles.js'
import { greeting } from '../../utils/format.js'

const SHORTCUTS = [
  { to: '/projects', label: 'Projects', hint: 'Status, hours and budget per project', icon: <FolderOutlinedIcon />, roles: Object.values(ROLES) },
  { to: '/team', label: 'My team', hint: 'Who shares your manager', icon: <GroupsOutlinedIcon />, roles: [ROLES.MANAGER, ROLES.EMPLOYEE] },
  { to: '/users', label: 'Users', hint: 'Accounts, roles and availability', icon: <PeopleOutlinedIcon />, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { to: '/audit-log', label: 'Audit log', hint: 'Every recorded action', icon: <HistoryOutlinedIcon />, roles: [ROLES.ADMIN] },
  { to: '/profile', label: 'Profile', hint: 'Your details and contact info', icon: <PersonOutlineIcon />, roles: Object.values(ROLES) },
]

/** Role-aware landing page. Live content per role arrives in slice 5 (ui-flow.md). */
export default function DashboardPage() {
  const { user } = useAuth()
  const shortcuts = SHORTCUTS.filter((s) => s.roles.includes(user.role))
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.firstName}`} subtitle={`Welcome back · signed in as ${ROLE_LABELS[user.role]}`} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
        {shortcuts.map((s) => (
          <Paper
            key={s.to}
            component={RouterLink}
            to={s.to}
            sx={{
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 120ms, background-color 120ms',
              '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
              '&:hover .arrow': { opacity: 1, transform: 'translateX(0)' },
            }}
          >
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'text.primary', flexShrink: 0 }}>
              {s.icon}
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{s.label}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {s.hint}
              </Typography>
            </Box>
            <ArrowForwardIcon className="arrow" sx={{ fontSize: 18, color: 'text.secondary', opacity: 0, transform: 'translateX(-4px)', transition: 'all 120ms' }} />
          </Paper>
        ))}
      </Box>
      <Paper sx={{ p: 3, mt: 3, borderStyle: 'dashed' }}>
        <Typography variant="subtitle2">Coming next</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Your open goals, hours logged this week and project health will appear here.
        </Typography>
      </Paper>
    </>
  )
}
