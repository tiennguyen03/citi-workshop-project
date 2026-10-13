import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import Tag from '../Tag/Tag.jsx'

const STATUS = {
  active: { label: 'Active', tone: 'info' },
  open: { label: 'Open', tone: 'info' },
  complete: { label: 'Complete', tone: 'success' },
}

/** Project/milestone status badge, plus an "Archived" badge when applicable. */
export default function StatusChip({ status, archived = false, size = 'small' }) {
  const meta = STATUS[status] ?? { label: status, tone: 'neutral' }
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Tag size={size} tone={archived ? 'neutral' : meta.tone} label={meta.label} dot={!archived} />
      {archived && <Tag size={size} tone="warning" label="Archived" />}
    </Stack>
  )
}

StatusChip.propTypes = {
  status: PropTypes.string.isRequired,
  archived: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium']),
}
