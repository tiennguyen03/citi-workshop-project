import { useState } from 'react'
import { flushSync } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderIcon from '@mui/icons-material/Folder'
import GroupIcon from '@mui/icons-material/Group'
import PeopleIcon from '@mui/icons-material/People'
import HistoryIcon from '@mui/icons-material/History'
import PersonIcon from '@mui/icons-material/Person'
import LogoutIcon from '@mui/icons-material/Logout'
import useAuth from '../../auth/useAuth.js'
import { ROLES, ROLE_LABELS, fullName } from '../../utils/roles.js'

const DRAWER_WIDTH = 240

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon />, roles: Object.values(ROLES), end: true },
  { to: '/projects', label: 'Projects', icon: <FolderIcon />, roles: Object.values(ROLES) },
  { to: '/team', label: 'My team', icon: <GroupIcon />, roles: [ROLES.MANAGER, ROLES.EMPLOYEE] },
  { to: '/users', label: 'Users', icon: <PeopleIcon />, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { to: '/audit-log', label: 'Audit log', icon: <HistoryIcon />, roles: [ROLES.ADMIN] },
  { to: '/profile', label: 'Profile', icon: <PersonIcon />, roles: Object.values(ROLES) },
]

/** Application frame: top bar, role-aware navigation drawer (collapsible on mobile), content outlet. */
export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = useState(false)

  // Sign out, then land on /login with NO remembered "from" location, so the next person to
  // sign in is not bounced to a page the previous user was on (and may not be allowed to see).
  // flushSync lets RequireAuth perform its own redirect first; ours then replaces it.
  const handleLogout = () => {
    flushSync(() => logout())
    navigate('/login', { replace: true })
  }

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user?.role))

  const drawer = (
    <Box role="navigation" aria-label="Main navigation">
      <Toolbar />
      <Divider />
      <List>
        {items.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            sx={{ '&.active': { bgcolor: 'action.selected', fontWeight: 600 } }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton color="inherit" edge="start" aria-label="Open navigation" onClick={() => setOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }} noWrap>
            Project Tracker
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {fullName(user)}
          </Typography>
          <Chip size="small" color="secondary" label={ROLE_LABELS[user?.role] ?? user?.role} />
          <Tooltip title="Sign out">
            <IconButton color="inherit" aria-label="Sign out" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
