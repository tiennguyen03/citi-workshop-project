import PropTypes from 'prop-types'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ProgressBar from '../ProgressBar/ProgressBar.jsx'

/**
 * Single headline figure with a label and optional hint. Tiles sit flat on a tinted ground (no border), so
 * they read as numbers rather than as yet another card; bordered Paper is kept for sections and tables (D20).
 * The figure is the largest thing on the tile (h3 scale); the label and hint are one muted line each (D24).
 * `to` turns the tile into a link (the number is a shortcut to the list behind it); `progress` draws a bar
 * without a caption (the hint already says the numbers); `footer` is for anything else under the hint; `action`
 * is the one button that belongs to the figure.
 */
export default function StatCard({ label, value, hint, color = 'text.primary', to, footer, icon, progress, action }) {
  const linkProps = to ? { component: RouterLink, to, sx: { textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: 'action.selected' } } } : {}
  return (
    <Paper {...linkProps} variant="elevation" elevation={0} sx={{ p: 2.5, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', ...linkProps.sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        {icon && <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 20 } }}>{icon}</Box>}
      </Box>
      <Typography variant="h3" component="p" sx={{ color, mt: 0.75 }} noWrap>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {hint}
        </Typography>
      )}
      {progress && (
        <Box sx={{ mt: 1.5 }}>
          <ProgressBar value={progress.value} max={progress.max} color={progress.color} kind={progress.kind} caption={progress.caption} showCaption={false} />
        </Box>
      )}
      {footer && <Box sx={{ mt: 1.5 }}>{footer}</Box>}
      {action && <Box sx={{ mt: 'auto', pt: 2 }}>{action}</Box>}
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
  progress: PropTypes.shape({
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    color: PropTypes.oneOf(['auto', 'primary', 'warning', 'error', 'success']),
    kind: PropTypes.oneOf(['capacity', 'completion']),
    caption: PropTypes.node, // used for the bar's accessible name only
  }),
  action: PropTypes.node, // a button that belongs to the figure ("Log time" under this week's hours)
}
