import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

/**
 * Heading for a section of a page: a small muted icon that says what kind of thing follows, the title, an optional
 * `description` right under it (a summary such as "2 at risk, 1 to close"), and an optional `aside` on the right
 * for an action (a button or link). Summaries belong next to the title they explain, not at the far edge (D24).
 */
export default function SectionHeading({ icon, title, description, aside, sx }) {
  return (
    <Stack direction="row" sx={[{ justifyContent: 'space-between', alignItems: description ? 'flex-start' : 'center', gap: 2, mb: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          {icon && <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 20 } }}>{icon}</Box>}
          <Typography variant="h6" component="h2" noWrap>
            {title}
          </Typography>
        </Stack>
        {description && (
          <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {aside && <Box sx={{ flexShrink: 0 }}>{aside}</Box>}
    </Stack>
  )
}

SectionHeading.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  aside: PropTypes.node,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
}
