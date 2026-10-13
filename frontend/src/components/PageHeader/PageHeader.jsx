import PropTypes from 'prop-types'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

/** Page title row: optional back link above, title + subtitle on the left, actions on the right. */
export default function PageHeader({ title, subtitle, actions, back }) {
  return (
    <Box sx={{ mb: 3.5 }}>
      {back && (
        <Link
          component={back.to ? RouterLink : 'button'}
          to={back.to}
          onClick={back.onClick}
          underline="none"
          color="text.secondary"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 1.5,
            fontSize: '0.8125rem',
            fontWeight: 500,
            '&:hover': { color: 'text.primary' },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          {back.label}
        </Link>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>{actions}</Box>}
      </Box>
    </Box>
  )
}

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  back: PropTypes.shape({ label: PropTypes.node.isRequired, to: PropTypes.string, onClick: PropTypes.func }),
}
