import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { paletteColor } from '../../utils/theme.js'

const TONES = { neutral: null, primary: 'primary', accent: 'secondary', success: 'success', warning: 'warning', error: 'error', info: 'info' }

/**
 * A structured one-line summary for a section heading (D25): "● 3 At risk   ● 2 On track" or "24 h logged  120 h
 * capacity". The figure is emphasised, the label is muted, an optional dot carries the figure's tone. Quiet by design:
 * it sits under a section title and must never compete with it.
 */
export default function SummaryRow({ items, 'aria-label': ariaLabel }) {
  return (
    <Box component="dl" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', m: 0 }}>
      {items.map((item) => {
        const color = TONES[item.tone] ?? null
        return (
          <Box key={item.key ?? String(item.label)} sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, whiteSpace: 'nowrap' }}>
            {item.tone && (
              <Box
                component="span"
                aria-hidden
                sx={[{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, alignSelf: 'center' }, (theme) => ({ bgcolor: color ? paletteColor(theme, color) : 'text.disabled' })]}
              />
            )}
            <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </Typography>
            <Typography component="dt" variant="body2" color="text.secondary">
              {item.label}
            </Typography>
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
  'aria-label': PropTypes.string,
}
