import PropTypes from 'prop-types'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

/** Single headline number with a label and optional hint. */
export default function StatCard({ label, value, hint, color = 'text.primary' }) {
  return (
    <Paper sx={{ p: 2, flex: '1 1 160px', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ color, fontWeight: 600 }} noWrap>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
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
