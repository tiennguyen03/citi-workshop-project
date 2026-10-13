import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** Read-only label/value pairs laid out in a responsive grid (definition list). */
export default function FieldList({ items, columns = 4 }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gap: 2.5,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: `repeat(${Math.min(columns, 3)}, minmax(0, 1fr))`, md: `repeat(${columns}, minmax(0, 1fr))` },
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="overline" color="text.secondary" sx={{ display: 'block' }}>
            {item.label}
          </Typography>
          <Typography component="dd" sx={{ m: 0, mt: 0.25, fontWeight: 500, overflowWrap: 'anywhere' }}>
            {item.value ?? '—'}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

FieldList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.node })).isRequired,
  columns: PropTypes.number,
}
