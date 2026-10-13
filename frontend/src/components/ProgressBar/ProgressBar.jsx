import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

/** Hours-style progress: `value` of `max`, with a caption. Turns red past 100%. */
export default function ProgressBar({ value, max, caption }) {
  const pct = max > 0 ? Math.round((Number(value) / Number(max)) * 100) : 0
  const clamped = Math.min(pct, 100)
  return (
    <Box sx={{ minWidth: 120 }}>
      <LinearProgress
        variant="determinate"
        value={clamped}
        color={pct > 100 ? 'error' : pct >= 90 ? 'warning' : 'primary'}
        aria-label={caption ?? `${pct}%`}
        sx={{ height: 8, borderRadius: 4 }}
      />
      <Typography variant="caption" color="text.secondary">
        {caption ?? `${pct}%`}
      </Typography>
    </Box>
  )
}

ProgressBar.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  caption: PropTypes.node,
}
