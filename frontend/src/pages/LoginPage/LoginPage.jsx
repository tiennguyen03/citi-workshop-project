import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useAuth from '../../auth/useAuth.js'
import BrandMark from '../../components/BrandMark/BrandMark.jsx'

/** Username + password sign-in (ui-flow.md F1). */
export default function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  if (status === 'authed') {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />
  }

  const canSubmit = username.trim().length > 0 && password.length > 0 && !pending

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setPending(true)
    setError(null)
    try {
      await login(username.trim(), password)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      // The API already distinguishes bad credentials from a deactivated account (security.md);
      // show its message, falling back to a generic one for anything unexpected.
      setError(err.message || 'Invalid username or password')
      setPending(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
        py: 6,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <BrandMark size={36} />
      </Box>
      <Paper component="form" onSubmit={handleSubmit} noValidate sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" component="h1">
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Use the account your admin created for you.
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          <Button type="submit" variant="contained" size="large" disabled={!canSubmit}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 3 }}>
        Time · Cost · Resources, in one place.
      </Typography>
    </Box>
  )
}
