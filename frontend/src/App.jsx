import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import theme from './theme.js'
import AuthProvider from './auth/AuthProvider.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import AppShell from './components/AppShell/AppShell.jsx'
import LoginPage from './pages/LoginPage/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage/DashboardPage.jsx'
import ForbiddenPage from './pages/ForbiddenPage/ForbiddenPage.jsx'
import NotFoundPage from './pages/NotFoundPage/NotFoundPage.jsx'

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
