import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

/** Shows an API/network error with an optional retry action. Renders nothing when error is null. */
export default function ErrorAlert({ error, onRetry }) {
  if (!error) return null
  return (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {error.message || 'Something went wrong'}
    </Alert>
  )
}

ErrorAlert.propTypes = {
  error: PropTypes.shape({ message: PropTypes.string }),
  onRetry: PropTypes.func,
}
