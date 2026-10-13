import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

/** Toast for mutation feedback. Pairs with hooks/useNotice. */
export default function NoticeSnackbar({ notice, onClose }) {
  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') return
    onClose()
  }
  return (
    <Snackbar
      key={notice?.key}
      open={Boolean(notice)}
      autoHideDuration={notice?.severity === 'error' ? 8000 : 4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {notice ? (
        <Alert onClose={handleClose} severity={notice.severity} variant="filled" sx={{ width: '100%' }}>
          {notice.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  )
}

NoticeSnackbar.propTypes = {
  notice: PropTypes.shape({
    message: PropTypes.string.isRequired,
    severity: PropTypes.oneOf(['success', 'error', 'info', 'warning']).isRequired,
    key: PropTypes.number,
  }),
  onClose: PropTypes.func.isRequired,
}
