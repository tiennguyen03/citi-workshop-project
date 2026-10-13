import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'

/**
 * Modal form wrapper: title, fields (children), form-level error, cancel/submit.
 * The parent owns field state and calls the API in onSubmit.
 */
export default function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  pending = false,
  error = null,
  children,
  maxWidth = 'sm',
}) {
  const handleClose = (_event, reason) => {
    if (pending && reason === 'backdropClick') return
    onClose()
  }
  const handleSubmit = (event) => {
    event.preventDefault()
    if (!pending) onSubmit()
  }
  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth={maxWidth} aria-labelledby="form-dialog-title">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="form-dialog-title">{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

FormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.node,
  pending: PropTypes.bool,
  error: PropTypes.string,
  children: PropTypes.node,
  maxWidth: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
}
