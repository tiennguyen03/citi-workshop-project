import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { paletteColor } from '../../utils/theme.js'

const TONES = { neutral: null, primary: 'primary', accent: 'secondary', success: 'success', warning: 'warning', error: 'error', info: 'info' }

/**
 * One compact summary line under a section heading (D25). Two readings:
 * - `variant="measure"` (default): the figure first, then what it measures — "24 h logged this week".
 * - `variant="tally"`: a category then its count — "● At risk 1   ● On track 2" — for health, readiness, status buckets.
 * The dot carries the tone, the label is quiet, the count is emphasised but body-sized; items share one baseline and one
 * gap, and nothing is a pill, so the line stays subordinate to the heading it sits under.
 */
export default function SummaryRow({ items, variant = 'measure', 'aria-label': ariaLabel }) {
  const tally = variant === 'tally'
  return (
    <Box component="dl" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2.5, rowGap: 0.5, m: 0 }}>
      {items.map((item) => {
        const color = TONES[item.tone] ?? null
        const dot = item.tone && (
          <Box
            component="span"
            aria-hidden
            sx={[{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, alignSelf: 'center' }, (theme) => ({ bgcolor: color ? paletteColor(theme, color) : 'text.disabled' })]}
          />
        )
        const value = (
          <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </Typography>
        )
        const label = (
          <Typography component="dt" variant="body2" color="text.secondary">
            {item.label}
          </Typography>
        )
        return (
          <Box key={item.key ?? String(item.label)} sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, whiteSpace: 'nowrap' }}>
            {dot}
            {tally ? label : value}
            {tally ? value : label}
          </Box>
        )
      })}
    </Box>
  )
}

SummaryRow.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      value: PropTypes.node.isRequired,
      label: PropTypes.node.isRequired,
      tone: PropTypes.oneOf(Object.keys(TONES)),
    }),
  ).isRequired,
  variant: PropTypes.oneOf(['measure', 'tally']),
  'aria-label': PropTypes.string,
}
