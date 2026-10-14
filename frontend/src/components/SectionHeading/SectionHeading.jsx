import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

/**
 * Heading for a section of a page: a small muted icon that says what kind of thing follows, the title,
 * and an optional `aside` on the right (a caption or a button). Icons are decorative; the title carries the meaning.
 */
export default function SectionHeading({ icon, title, aside, sx }) {
  return (
    <Stack direction="row" sx={[{ justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
        {icon && <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 20 } }}>{icon}</Box>}
        <Typography variant="h6" component="h2" noWrap>
          {title}
        </Typography>
      </Stack>
      {aside && <Box sx={{ flexShrink: 0 }}>{aside}</Box>}
    </Stack>
  )
}

SectionHeading.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node.isRequired,
  aside: PropTypes.node,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
}
