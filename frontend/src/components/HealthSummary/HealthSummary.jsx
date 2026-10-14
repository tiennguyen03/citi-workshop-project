import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import HealthTag from '../HealthTag/HealthTag.jsx'
import { REASON } from '../../utils/projectHealth.js'

/**
 * A project's health the same way everywhere (D21, D24): the one-word state as the tag, the reasons as one muted
 * line under it ("Overdue milestone, over budget"), never a second row of pills. `hideTag` keeps just the reasons
 * (manager cards for a complete project, where the status already says it).
 */
export default function HealthSummary({ health, reasons = [], hideTag = false, align = 'left' }) {
  const text = reasons.map((r, i) => {
    const label = REASON[r]?.label ?? r
    return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)
  })
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 0.5, minWidth: 0 }}>
      {!hideTag && <HealthTag health={health} />}
      {text.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: align, lineHeight: 1.4 }}>
          {text.join(', ')}
        </Typography>
      )}
    </Box>
  )
}

HealthSummary.propTypes = {
  health: PropTypes.string.isRequired,
  reasons: PropTypes.arrayOf(PropTypes.string),
  hideTag: PropTypes.bool,
  align: PropTypes.oneOf(['left', 'right']),
}
