import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

export default function ForbiddenPage() {
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 6, md: 12 } }}>
      <Typography variant="overline" color="text.secondary">
        403
      </Typography>
      <Typography variant="h3" component="h1" sx={{ mt: 1 }}>
        Access denied
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Your role doesn&apos;t have permission to view this page.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Go to dashboard
      </Button>
    </Box>
  )
}
