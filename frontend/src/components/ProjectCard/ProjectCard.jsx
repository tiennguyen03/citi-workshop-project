import PropTypes from 'prop-types'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DueTag from '../DueTag/DueTag.jsx'
import FieldList from '../FieldList/FieldList.jsx'
import HealthSummary from '../HealthSummary/HealthSummary.jsx'
import ProgressBar from '../ProgressBar/ProgressBar.jsx'
import StatusChip from '../StatusChip/StatusChip.jsx'
import { formatDate, formatHours, formatMoney } from '../../utils/format.js'

/** Inner links on a clickable card: let the link navigate without the card also firing. */
const stop = (e) => e.stopPropagation()

/**
 * A project's executive summary (D25): read top to bottom as name, health, reason, progress, then three metrics.
 * One strong signal only — the health tag — with the reason as muted text beneath it; lifecycle status appears
 * only when it is the whole story (a complete project shows "Complete" in the health slot instead of a tag).
 * Progress is one unit: "3% complete", the raw hours, one full-width bar. Next due's urgency is supporting text.
 */
export default function ProjectCard({ project: p }) {
  const navigate = useNavigate()
  const done = p.health === 'to_close' || p.status === 'complete'
  return (
    <Paper
      role="article"
      aria-label={p.name}
      onClick={() => navigate(`/projects/${p.id}`)}
      sx={{ p: 2.5, display: 'block', cursor: 'pointer', '&:hover': { borderColor: 'text.secondary' } }}
    >
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Link component={RouterLink} to={`/projects/${p.id}`} underline="hover" color="inherit" variant="h6" sx={{ display: 'block', overflowWrap: 'anywhere' }} onClick={stop}>
            {p.name}
          </Link>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {formatDate(p.startDate)} – {formatDate(p.endDate)},{' '}
            <Link component={RouterLink} to={`/projects/${p.id}?tab=members`} underline="hover" color="inherit" onClick={stop}>
              {p.memberCount} member{p.memberCount === 1 ? '' : 's'}
            </Link>
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          {done ? (
            <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              <StatusChip status="complete" />
              {p.reasons?.length > 0 && <HealthSummary health={p.health ?? 'to_close'} reasons={p.reasons} hideTag align="right" />}
            </Box>
          ) : p.health ? (
            <HealthSummary health={p.health} reasons={p.reasons ?? []} align="right" />
          ) : (
            <StatusChip status={p.status} />
          )}
        </Box>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <ProgressBar layout="block" suffix="complete" value={p.hoursCompleted} max={p.capacityHours} caption={`${formatHours(p.hoursCompleted)} / ${formatHours(p.capacityHours)}`} />
      </Box>
      <Box sx={{ mt: 2.5 }}>
        <FieldList
          columns={3}
          items={[
            {
              label: 'Budget remaining',
              value: (
                <Typography component="span" sx={{ fontWeight: 600, color: Number(p.budgetRemaining) < 0 ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(p.budgetRemaining)}
                </Typography>
              ),
            },
            {
              label: 'Open milestones',
              value: (
                <>
                  <Link
                    component={RouterLink}
                    to={`/projects/${p.id}?tab=milestones`}
                    underline="hover"
                    color="inherit"
                    onClick={stop}
                    aria-label={`${p.milestoneCounts.open} open milestones`}
                    sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {p.milestoneCounts.open} open
                  </Link>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {p.milestoneCounts.complete} complete
                  </Typography>
                </>
              ),
            },
            {
              label: 'Next due',
              value: p.nextDueDate ? (
                <>
                  <Typography component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(p.nextDueDate)}
                  </Typography>
                  <Box sx={{ mt: 0.25 }}>
                    <DueTag dueDate={p.nextDueDate} isOpen={!done} variant="quiet" />
                  </Box>
                </>
              ) : (
                <Typography component="span" color="text.secondary">
                  —
                </Typography>
              ),
            },
          ]}
        />
      </Box>
    </Paper>
  )
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    startDate: PropTypes.string.isRequired,
    endDate: PropTypes.string.isRequired,
    memberCount: PropTypes.number.isRequired,
    hoursCompleted: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    capacityHours: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    budgetRemaining: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    milestoneCounts: PropTypes.shape({ open: PropTypes.number, complete: PropTypes.number }).isRequired,
    nextDueDate: PropTypes.string,
    health: PropTypes.string,
    reasons: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
}
