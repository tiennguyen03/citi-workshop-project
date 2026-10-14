import PropTypes from 'prop-types'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

/**
 * Single headline number with a label and optional hint. `to` turns the whole card into a link
 * (the number is a shortcut to the list behind it); `footer` sits under the hint, e.g. a ProgressBar.
 */
export default function StatCard({ label, value, hint, color = 'text.primary', to, footer }) {
  const linkProps = to ? { component: RouterLink, to, sx: { textDecoration: 'none', color: 'inherit', '&:hover': { borderColor: 'text.secondary' } } } : {}
  return (
    <Paper {...linkProps} sx={{ p: 2.5, minWidth: 0, display: 'block', ...linkProps.sx }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h4" component="p" sx={{ color, mt: 0.5, fontVariantNumeric: 'tabular-nums' }} noWrap>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {hint}
        </Typography>
      )}
      {footer && <Box sx={{ mt: 1.5 }}>{footer}</Box>}
    </Paper>
  )
}

StatCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  hint: PropTypes.node,
  color: PropTypes.string,
  to: PropTypes.string,
  footer: PropTypes.node,
}
