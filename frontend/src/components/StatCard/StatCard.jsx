import PropTypes from 'prop-types'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

/** Single headline number with a label and optional hint. */
export default function StatCard({ label, value, hint, color = 'text.primary' }) {
  return (
    <Paper sx={{ p: 2.5, minWidth: 0 }}>
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
    </Paper>
  )
}

StatCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  hint: PropTypes.node,
  color: PropTypes.string,
}
