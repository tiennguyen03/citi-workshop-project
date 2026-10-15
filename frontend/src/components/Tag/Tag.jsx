import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import { paletteColor, tint } from '../../utils/theme.js'

const TONES = { neutral: null, primary: 'primary', accent: 'secondary', success: 'success', warning: 'warning', error: 'error', info: 'info' }

/**
 * Label for statuses and roles. Two weights (D24): `tinted` (soft fill + border) for the exception that should
 * pull the eye — Overdue, At risk, Archived, Deactivated, Available — and `quiet` (a coloured dot and plain text)
 * for the normal state — Active, Complete, Employee, a 200 or a 401 result — so a list of normal rows reads as text
 * and the one exception stands out. Quiet text is always full contrast (D25); only the dot carries the tone.
 */
export default function Tag({ label, tone = 'neutral', size = 'small', dot = false, variant = 'tinted' }) {
  const color = TONES[tone] ?? null
  const quiet = variant === 'quiet'
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
          px: quiet ? 0 : size === 'small' ? 1 : 1.25,
          height: size === 'small' ? 22 : 26,
          fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
          border: quiet ? 0 : '1px solid',
        },
        (theme) =>
          quiet
            ? { color: 'text.primary', '& .Tag-dot': { bgcolor: color ? paletteColor(theme, color) : 'text.disabled' } }
            : color
              ? {
                  color: paletteColor(theme, color, 'dark'),
                  bgcolor: tint(theme, color, 0.1),
                  borderColor: tint(theme, color, 0.25),
                  '& .Tag-dot': { bgcolor: 'currentColor' },
                }
              : {
                  color: 'text.secondary',
                  bgcolor: (theme.vars || theme).palette.action.hover,
                  borderColor: 'divider',
                  '& .Tag-dot': { bgcolor: 'currentColor' },
                },
        (theme) => theme.applyStyles('dark', !quiet && color ? { color: paletteColor(theme, color, 'light') } : {}),
      ]}
    >
      {(dot || quiet) && <Box component="span" className="Tag-dot" sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }} />}
      {label}
    </Box>
  )
}

Tag.propTypes = {
  label: PropTypes.node.isRequired,
  tone: PropTypes.oneOf(Object.keys(TONES)),
  size: PropTypes.oneOf(['small', 'medium']),
  dot: PropTypes.bool,
  variant: PropTypes.oneOf(['tinted', 'quiet']),
}
