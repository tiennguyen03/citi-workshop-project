import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

/**
 * Hours-style progress: `value` of `max`, with a caption. `color="auto"` (default) goes amber
 * from 90% and red past 100%; pass a palette colour to pin it.
 * `layout="stacked"` (default) puts the caption under the bar, for tiles and panels.
 * `layout="inline"` puts the bar, the raw figures and the percentage on one line, for table cells (D24):
 * a 3 % bar is invisible on its own, the number is what the reader scans.
 * `showCaption={false}` keeps just the bar (a StatCard's hint already says the numbers).
 */
export default function ProgressBar({ value, max, caption, color = 'auto', layout = 'stacked', showCaption = true }) {
  const pct = max > 0 ? Math.round((Number(value) / Number(max)) * 100) : 0
  const clamped = Math.min(pct, 100)
  const barColor = color !== 'auto' ? color : pct > 100 ? 'error' : pct >= 90 ? 'warning' : 'primary'
  const label = caption ?? `${pct}%`
  const bar = <LinearProgress variant="determinate" value={clamped} color={barColor} aria-label={`${label}, ${pct}%`} />
  if (layout === 'inline') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 180 }}>
        <Box sx={{ flexGrow: 1, minWidth: 56 }}>{bar}</Box>
        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: '3.5ch', textAlign: 'right', fontWeight: 600 }}>
          {pct}%
        </Typography>
        {showCaption && caption && (
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {caption}
          </Typography>
        )}
      </Box>
    )
  }
  return (
    <Box sx={{ minWidth: 120 }}>
      {bar}
      {showCaption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
          {label}
        </Typography>
      )}
    </Box>
  )
}

ProgressBar.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  caption: PropTypes.node,
  color: PropTypes.oneOf(['auto', 'primary', 'warning', 'error']),
  layout: PropTypes.oneOf(['stacked', 'inline']),
  showCaption: PropTypes.bool,
}
