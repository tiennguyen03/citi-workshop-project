import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** Logo square + wordmark. */
export default function BrandMark({ size = 28, withText = true }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        aria-hidden
        sx={{
          width: size,
          height: size,
          borderRadius: `${Math.round(size * 0.3)}px`,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Box component="svg" viewBox="0 0 24 24" sx={{ width: size * 0.6, height: size * 0.6 }} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M5 17V7" />
          <path d="M12 17v-6" />
          <path d="M19 17V4" />
        </Box>
      </Box>
      {withText && (
        <Typography component="span" sx={{ fontWeight: 700, letterSpacing: '-0.01em', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>
          Project Tracker
        </Typography>
      )}
    </Box>
  )
}

BrandMark.propTypes = {
  size: PropTypes.number,
  withText: PropTypes.bool,
}
