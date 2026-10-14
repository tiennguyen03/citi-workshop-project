import PropTypes from 'prop-types'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

/**
 * Single headline figure with a label and optional hint. Tiles sit flat on a tinted ground (no border), so
 * they read as numbers rather than as yet another card; bordered Paper is kept for sections and tables (D20).
 * `to` turns the tile into a link (the number is a shortcut to the list behind it); `footer` sits under
 * the hint, e.g. a ProgressBar.
 */
export default function StatCard({ label, value, hint, color = 'text.primary', to, footer, icon }) {
  const linkProps = to ? { component: RouterLink, to, sx: { textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: 'action.selected' } } } : {}
  return (
    <Paper {...linkProps} variant="elevation" elevation={0} sx={{ p: 2.5, minWidth: 0, display: 'block', bgcolor: 'background.default', ...linkProps.sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        {icon && <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 20 } }}>{icon}</Box>}
      </Box>
      <Typography variant="h4" component="p" sx={{ color, mt: 0.5 }} noWrap>
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
  icon: PropTypes.node,
}
