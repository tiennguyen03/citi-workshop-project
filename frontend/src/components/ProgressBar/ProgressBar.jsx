import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

/** The smallest bar a non-zero value may draw, so 1 % is visible without pretending to be 10 %. */
const MIN_VISIBLE = 3

/**
 * A share of something: `value` of `max`. Hours against capacity, goals against goals, cost against budget.
 * `kind="capacity"` (default) is spend against a limit: amber from 90 %, red past 100 %.
 * `kind="completion"` is work done: green at 100 %.
 * `layout="stacked"` (default) is a tile or panel: bar, caption under it.
 * `layout="inline"` is the one table treatment (D25): the percentage first (the figure to scan), the raw figures
 * muted beside it, the bar under both; compact enough for a small row.
 * `layout="block"` is a card's progress unit (D25): "3% complete" on the left, the raw figures muted on the right, a
 * full-width bar beneath. `suffix` is the word after the percentage ("complete").
 * `showCaption={false}` keeps just the bar (a StatCard's hint already says the numbers).
 */
export default function ProgressBar({ value, max, caption, color = 'auto', kind = 'capacity', layout = 'stacked', showCaption = true, suffix }) {
  const pct = max > 0 ? Math.round((Number(value) / Number(max)) * 100) : 0
  const drawn = pct <= 0 ? 0 : Math.min(Math.max(pct, MIN_VISIBLE), 100)
  const auto = kind === 'completion' ? (pct >= 100 ? 'success' : 'primary') : pct > 100 ? 'error' : pct >= 90 ? 'warning' : 'primary'
  const barColor = color !== 'auto' ? color : auto
  const label = caption ?? `${pct}%`
  const bar = <LinearProgress variant="determinate" value={drawn} color={barColor} aria-label={caption ? `${caption}, ${pct}%` : `${pct}%`} />
  if (layout === 'block') {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, mb: 0.75, fontVariantNumeric: 'tabular-nums' }}>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600, color: barColor === 'primary' ? 'text.primary' : `${barColor}.main` }}>
            {pct}%{suffix ? ` ${suffix}` : ''}
          </Typography>
          {showCaption && caption && (
            <Typography variant="caption" component="span" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {caption}
            </Typography>
          )}
        </Box>
        {bar}
      </Box>
    )
  }
  if (layout === 'inline') {
    return (
      <Box sx={{ minWidth: 150, maxWidth: 260 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600, minWidth: '3.5ch', color: barColor === 'primary' ? 'text.primary' : `${barColor}.main` }}>
            {pct}%
          </Typography>
          {showCaption && caption && (
            <Typography variant="caption" component="span" color="text.secondary">
              {caption}
            </Typography>
          )}
        </Box>
        {bar}
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
  color: PropTypes.oneOf(['auto', 'primary', 'warning', 'error', 'success']),
  kind: PropTypes.oneOf(['capacity', 'completion']),
  layout: PropTypes.oneOf(['stacked', 'inline', 'block']),
  showCaption: PropTypes.bool,
  suffix: PropTypes.string,
}
