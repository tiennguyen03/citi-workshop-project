import { Link as RouterLink } from 'react-router-dom'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

export default function ForbiddenPage() {
  return (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>
        Access denied
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Your role doesn&apos;t have permission to view this page.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Go to dashboard
      </Button>
    </Paper>
  )
}
