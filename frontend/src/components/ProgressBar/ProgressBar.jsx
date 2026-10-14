import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

/**
 * Hours-style progress: `value` of `max`, with a caption. `color="auto"` (default) goes amber
 * from 90% and red past 100%; pass a palette colour to pin it.
 */
export default function ProgressBar({ value, max, caption, color = 'auto' }) {
  const pct = max > 0 ? Math.round((Number(value) / Number(max)) * 100) : 0
  const clamped = Math.min(pct, 100)
  const barColor = color !== 'auto' ? color : pct > 100 ? 'error' : pct >= 90 ? 'warning' : 'primary'
  return (
    <Box sx={{ minWidth: 120 }}>
      <LinearProgress
        variant="determinate"
        value={clamped}
        color={barColor}
        aria-label={caption ?? `${pct}%`}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
        {caption ?? `${pct}%`}
      </Typography>
    </Box>
  )
}

ProgressBar.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  caption: PropTypes.node,
  color: PropTypes.oneOf(['auto', 'primary', 'warning', 'error']),
}
