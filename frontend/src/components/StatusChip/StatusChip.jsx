import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import Tag from '../Tag/Tag.jsx'

/** Active/open are the normal state (quiet, blue dot); complete is a final state worth a tinted label. */
const STATUS = {
  active: { label: 'Active', tone: 'info', variant: 'quiet' },
  open: { label: 'Open', tone: 'info', variant: 'quiet' },
  complete: { label: 'Complete', tone: 'success', variant: 'tinted' },
}

/** Project/milestone status label, plus an "Archived" tag when applicable. */
export default function StatusChip({ status, archived = false, size = 'small' }) {
  const meta = STATUS[status] ?? { label: status, tone: 'neutral', variant: 'quiet' }
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Tag size={size} tone={archived ? 'neutral' : meta.tone} label={meta.label} variant={archived ? 'quiet' : meta.variant} dot />
      {archived && <Tag size={size} tone="warning" label="Archived" />}
    </Stack>
  )
}

StatusChip.propTypes = {
  status: PropTypes.string.isRequired,
  archived: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium']),
}
