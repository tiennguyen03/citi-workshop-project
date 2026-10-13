import PropTypes from 'prop-types'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'

const STATUS = {
  active: { label: 'Active', color: 'primary' },
  complete: { label: 'Complete', color: 'success' },
  open: { label: 'Open', color: 'primary' },
}

/** Project/milestone status badge, plus an "Archived" badge when applicable. */
export default function StatusChip({ status, archived = false, size = 'small' }) {
  const meta = STATUS[status] ?? { label: status, color: 'default' }
  return (
    <Stack direction="row" spacing={0.5}>
      <Chip size={size} color={meta.color} label={meta.label} variant={archived ? 'outlined' : 'filled'} />
      {archived && <Chip size={size} label="Archived" />}
    </Stack>
  )
}

StatusChip.propTypes = {
  status: PropTypes.string.isRequired,
  archived: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium']),
}
