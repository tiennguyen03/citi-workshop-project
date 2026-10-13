import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import { paletteColor, tint } from '../../utils/theme.js'

const TONES = { neutral: null, primary: 'primary', accent: 'secondary', success: 'success', warning: 'warning', error: 'error', info: 'info' }

/** Soft, bordered label for statuses and roles. Quieter than a filled Chip; reads in both colour schemes. */
export default function Tag({ label, tone = 'neutral', size = 'small', dot = false }) {
  const color = TONES[tone] ?? null
  return (
    <Box
      component="span"
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          whiteSpace: 'nowrap',
          borderRadius: '6px',
          fontWeight: 500,
          lineHeight: 1,
          px: size === 'small' ? 1 : 1.25,
          height: size === 'small' ? 22 : 26,
          fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
          border: '1px solid',
        },
        (theme) =>
          color
            ? {
                color: paletteColor(theme, color, 'dark'),
                bgcolor: tint(theme, color, 0.1),
                borderColor: tint(theme, color, 0.25),
              }
            : {
                color: 'text.secondary',
                bgcolor: (theme.vars || theme).palette.action.hover,
                borderColor: 'divider',
              },
        (theme) => theme.applyStyles('dark', color ? { color: paletteColor(theme, color, 'light') } : {}),
      ]}
    >
      {dot && <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor', flexShrink: 0 }} />}
      {label}
    </Box>
  )
}

Tag.propTypes = {
  label: PropTypes.node.isRequired,
  tone: PropTypes.oneOf(Object.keys(TONES)),
  size: PropTypes.oneOf(['small', 'medium']),
  dot: PropTypes.bool,
}
