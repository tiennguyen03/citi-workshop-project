import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

/** Hours-style progress: `value` of `max`, with a caption. Amber from 90%, red past 100%. */
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
}
