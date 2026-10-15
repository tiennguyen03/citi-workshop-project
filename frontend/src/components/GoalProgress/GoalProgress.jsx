import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ProgressBar from '../ProgressBar/ProgressBar.jsx'

/**
 * Work completion for a project (D27): completed goals over the goals that exist, across every milestone. This is the
 * only place that turns the two counts into UI, so the wording and the no-goals state live once.
 * - `layout="inline"` for a table cell: "40%  4 / 10 goals" over a bar.
 * - `layout="block"` for a card or panel: "40% complete" left, "4 of 10 goals complete" right, a full-width bar.
 * No goals is "not configured", a different state from 0 % of existing work: it renders "—" and a muted note, no bar.
 */
export default function GoalProgress({ completedGoals, totalGoals, layout = 'inline', title }) {
  const total = Number(totalGoals) || 0
  const done = Number(completedGoals) || 0
  if (total <= 0) {
    return (
      <Box sx={{ minWidth: 0 }}>
        {title && (
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
            {title}
          </Typography>
        )}
        <Typography variant={layout === 'block' ? 'body2' : 'caption'} component="div" sx={{ fontWeight: 600 }}>
          —
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          No goals configured
        </Typography>
      </Box>
    )
  }
  if (layout === 'block') {
    return (
      <Box sx={{ minWidth: 0 }}>
        {title && (
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {title}
          </Typography>
        )}
        <ProgressBar layout="block" kind="completion" suffix="complete" value={done} max={total} caption={`${done} of ${total} goal${total === 1 ? '' : 's'} complete`} />
      </Box>
    )
  }
  return <ProgressBar layout="inline" kind="completion" value={done} max={total} caption={`${done} / ${total} goal${total === 1 ? '' : 's'}`} />
}

GoalProgress.propTypes = {
  completedGoals: PropTypes.number,
  totalGoals: PropTypes.number,
  layout: PropTypes.oneOf(['inline', 'block']),
  title: PropTypes.node, // an overline above the block ("Project progress")
}
