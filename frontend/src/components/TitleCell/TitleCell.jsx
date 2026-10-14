import PropTypes from 'prop-types'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

/** Inner links on a clickable row: let the link navigate without the row also firing. */
const stop = (e) => e.stopPropagation()

/**
 * The two-line table cell: a title that carries the row (600 weight, optionally a link) over a muted caption
 * that supports it — project over manager, action over its code, milestone over its description (D24).
 * `adornment` sits beside the title (a small tag such as "Next due").
 */
export default function TitleCell({ title, caption, to, adornment, captionNoWrap = false }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
        {to ? (
          <Link component={RouterLink} to={to} underline="hover" color="inherit" sx={{ fontWeight: 600 }} onClick={stop}>
            {title}
          </Link>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        )}
        {adornment}
      </Stack>
      {caption && (
        <Typography variant="caption" color="text.secondary" noWrap={captionNoWrap} sx={{ display: 'block', maxWidth: captionNoWrap ? 360 : undefined }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}

TitleCell.propTypes = {
  title: PropTypes.node.isRequired,
  caption: PropTypes.node,
  to: PropTypes.string,
  adornment: PropTypes.node,
  captionNoWrap: PropTypes.bool,
}
