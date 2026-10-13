import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import theme from './theme.js'
import AuthProvider from './auth/AuthProvider.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import RequireRole from './auth/RequireRole.jsx'
import AppShell from './components/AppShell/AppShell.jsx'
import LoginPage from './pages/LoginPage/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage/DashboardPage.jsx'
import UsersPage from './pages/UsersPage/UsersPage.jsx'
import UserDetailPage from './pages/UserDetailPage/UserDetailPage.jsx'
import ProfilePage from './pages/ProfilePage/ProfilePage.jsx'
import TeamPage from './pages/TeamPage/TeamPage.jsx'
import AuditLogPage from './pages/AuditLogPage/AuditLogPage.jsx'
import ForbiddenPage from './pages/ForbiddenPage/ForbiddenPage.jsx'
import NotFoundPage from './pages/NotFoundPage/NotFoundPage.jsx'
import { ROLES } from './utils/roles.js'

/** Route table (ui-flow.md). Feature routes are added slice by slice. */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/users/:id" element={<UserDetailPage />} />
                <Route element={<RequireRole roles={[ROLES.ADMIN, ROLES.MANAGER]} />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
                <Route element={<RequireRole roles={[ROLES.MANAGER, ROLES.EMPLOYEE]} />}>
                  <Route path="/team" element={<TeamPage />} />
                </Route>
                <Route element={<RequireRole roles={[ROLES.ADMIN]} />}>
                  <Route path="/audit-log" element={<AuditLogPage />} />
                </Route>
                <Route path="/403" element={<ForbiddenPage />} />
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
