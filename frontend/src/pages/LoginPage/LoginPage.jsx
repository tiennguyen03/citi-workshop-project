import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useAuth from '../../auth/useAuth.js'
import BrandMark from '../../components/BrandMark/BrandMark.jsx'

/** The three things the tool measures (requirements.md: time, cost, resources). Set as type: this is the identity. */
const PILLARS = [
  ['Time', 'Hours planned against hours logged, week by week.'],
  ['Cost', 'Salaries against budget, as the hours come in.'],
  ['Resources', 'Who is free, who is stretched, and who is on what.'],
]

/** Username + password sign-in (ui-flow.md F1). Statement on the left, form on the right; stacked on phones. */
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
    <Box sx={{ minHeight: '100%', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 1fr)' }, bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 4,
          p: { xs: 3, sm: 4, md: 6 },
          borderRight: { md: '1px solid' },
          borderColor: { md: 'divider' },
        }}
      >
        {/* One measure for brand, statement and footer, centred in the panel but left-aligned inside it */}
        <Box sx={{ width: '100%', maxWidth: 640, mx: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4, flexGrow: 1 }}>
          <BrandMark size={32} />
          <Box>
            <Typography variant="h1" component="p" sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, maxWidth: '24ch', textWrap: 'balance' }}>
              Every project, measured three ways.
            </Typography>
            <Box component="dl" sx={{ m: 0, mt: { xs: 3, md: 5 }, display: { xs: 'none', md: 'grid' }, gap: 2 }}>
              {PILLARS.map(([term, detail]) => (
                <Box key={term} sx={{ display: 'grid', gridTemplateColumns: '8.5rem 1fr', columnGap: 2, alignItems: 'baseline' }}>
                  <Typography component="dt" variant="h4">
                    {term}
                  </Typography>
                  <Typography component="dd" variant="body1" color="text.secondary" sx={{ m: 0, whiteSpace: 'nowrap' }}>
                    {detail}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
            An internal tool. Accounts are created by an admin.
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 4, md: 6 }, bgcolor: 'background.paper' }}>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%', maxWidth: 380 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h3" component="h1">
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
        </Box>
      </Box>
    </Box>
  )
}
