import { useState } from 'react'
import { flushSync } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import useAuth from '../../auth/useAuth.js'
import BrandMark from '../BrandMark/BrandMark.jsx'
import ThemeModeToggle from '../ThemeModeToggle/ThemeModeToggle.jsx'
import { ROLES, ROLE_LABELS, fullName, initials } from '../../utils/roles.js'

const SIDEBAR_WIDTH = 248

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: <GridViewOutlinedIcon />, roles: Object.values(ROLES), end: true },
  { to: '/projects', label: 'Projects', icon: <FolderOutlinedIcon />, roles: Object.values(ROLES) },
  { to: '/team', label: 'My team', icon: <GroupsOutlinedIcon />, roles: [ROLES.MANAGER, ROLES.EMPLOYEE] },
  { to: '/users', label: 'Users', icon: <PeopleOutlinedIcon />, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { to: '/audit-log', label: 'Audit log', icon: <HistoryOutlinedIcon />, roles: [ROLES.ADMIN] },
  { to: '/profile', label: 'Profile', icon: <PersonOutlineIcon />, roles: Object.values(ROLES) },
]

/** Application frame: sidebar navigation (drawer on mobile), signed-in user block, content outlet. */
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

  const sidebar = (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <BrandMark />
        {isMobile && (
          <IconButton size="small" aria-label="Close navigation" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Typography variant="overline" color="text.secondary" sx={{ px: 3, pb: 0.5 }}>
        Workspace
      </Typography>
      <List component="nav" aria-label="Main navigation" sx={{ px: 1.5, py: 0 }}>
        {items.map((item) => (
          <ListItemButton key={item.to} component={NavLink} to={item.to} end={item.end} onClick={() => setOpen(false)} sx={{ mb: 0.25 }}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.selected', color: 'text.primary' }}>{initials(user)}</Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {fullName(user)}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {ROLE_LABELS[user?.role] ?? user?.role}
          </Typography>
        </Box>
        <ThemeModeToggle />
        <Tooltip title="Sign out">
          <IconButton size="small" aria-label="Sign out" onClick={handleLogout}>
            <LogoutOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100%', bgcolor: 'background.default' }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? 0 : SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'background.default',
            borderRadius: 0,
            borderWidth: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {sidebar}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        {isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              height: 56,
              borderBottom: '1px solid',
              borderColor: 'divider',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              bgcolor: 'background.paper',
            }}
          >
            <IconButton edge="start" aria-label="Open navigation" onClick={() => setOpen(true)}>
              <MenuIcon />
            </IconButton>
            <BrandMark size={24} />
          </Box>
        )}
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3, md: 5 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
