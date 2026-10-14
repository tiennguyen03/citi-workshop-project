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

/** Login-only input treatment: a firmer resting border and a 2 px primary focus ring, so the form reads as the thing to do. */
const FIELD_SX = {
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'text.disabled' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: 'primary.main' },
}

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
    <Box sx={{ minHeight: '100%', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, bgcolor: 'background.default' }}>
      {/* Statement. Its content hugs the centre line (right-aligned block) so the two halves read as one composition at any width. */}
      <Box
        component="section"
        aria-label="About Project Tracker"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 3, sm: 5, md: 6, lg: 8 },
          py: { xs: 3, sm: 4, md: 5 },
          borderRight: { md: '1px solid' },
          borderBottom: { xs: '1px solid', md: 'none' },
          borderColor: { xs: 'divider', md: 'divider' },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 560, ml: { md: 'auto' }, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <BrandMark size={32} />
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: { xs: 3, md: 8 } }}>
            <Typography variant="h1" component="p" sx={{ fontSize: { xs: '2.25rem', sm: '2.75rem', lg: '3.25rem' }, maxWidth: '18ch', textWrap: 'balance' }}>
              Every project, measured three ways.
            </Typography>
            {/* One grid for all three rows: the term column is as wide as "Resources", so each row stays a unit and the descriptions still line up */}
            <Box
              component="dl"
              sx={{ m: 0, mt: { xs: 3, md: 4 }, display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 2.5, rowGap: 1.5, alignItems: 'baseline' }}
            >
              {PILLARS.map(([term, detail]) => [
                <Typography key={`${term}-dt`} component="dt" variant="h4">
                  {term}
                </Typography>,
                <Typography key={`${term}-dd`} component="dd" variant="body1" color="text.secondary" sx={{ m: 0 }}>
                  {detail}
                </Typography>,
              ])}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 3, sm: 5 }, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
              An internal tool. Accounts are created by an admin.
            </Typography>
          </Box>
        </Box>
      </Box>
      {/* Form. Left-aligned to the centre line to mirror the statement; no card, the white panel is the container. */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 3, sm: 5, md: 6, lg: 8 }, py: { xs: 4, sm: 5, md: 5 }, bgcolor: 'background.paper' }}>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%', maxWidth: 440, mr: { md: 'auto' } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h3" component="h1">
                Sign in
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
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
              size="medium"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={pending}
              sx={FIELD_SX}
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              size="medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              sx={FIELD_SX}
            />
            <Button type="submit" variant="contained" color="primary" size="large" disabled={!canSubmit} sx={{ mt: 0.5, minHeight: 48 }}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
