import PropTypes from 'prop-types'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import { formatDate, formatHours, formatMoney } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

const REASON = {
  over_budget: { label: 'Over budget', tone: 'error' },
  past_end: { label: 'Past end date', tone: 'warning' },
}

const TEAM_COLUMNS = [
  { key: 'name', label: 'Name', nowrap: true, render: (t) => fullName(t.user) },
  { key: 'jobTitle', label: 'Job title', render: (t) => t.user.jobTitle },
  {
    key: 'currentProject',
    label: 'Current project',
    render: (t) => (t.currentProject ? t.currentProject.name : <Tag label="Available" tone="success" />),
  },
  { key: 'hoursThisWeek', label: 'Hours this week', align: 'right', render: (t) => formatHours(t.hoursThisWeek) },
]

/** Inner links on a clickable card: let the link navigate without the card also firing. */
const stop = (e) => e.stopPropagation()

/** Manager landing: one card per managed project and the team's availability (ui-flow.md › Per-role landing). */
export default function ManagerDashboard({ data }) {
  const navigate = useNavigate()
  const { projects, team, week } = data
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Your projects
        </Typography>
        {projects.length === 0 ? (
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              You are not managing any projects yet. An admin assigns projects to managers.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: projects.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 2fr) 1fr' } }}>
            {projects.map((p) => (
              <Paper
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                sx={{ p: 2.5, display: 'block', cursor: 'pointer', '&:hover': { borderColor: 'text.secondary' } }}
              >
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Link component={RouterLink} to={`/projects/${p.id}`} underline="hover" color="inherit" sx={{ fontWeight: 600, display: 'block' }} noWrap onClick={stop}>
                      {p.name}
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(p.startDate)} – {formatDate(p.endDate)} ·{' '}
                      <Link component={RouterLink} to={`/projects/${p.id}?tab=members`} underline="hover" color="inherit" onClick={stop}>
                        {p.memberCount} member{p.memberCount === 1 ? '' : 's'}
                      </Link>
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                    <StatusChip status={p.status} />
                    {p.reasons.map((r) => (
                      <Tag key={r} label={REASON[r].label} tone={REASON[r].tone} />
                    ))}
                  </Stack>
                </Stack>
                <ProgressBar value={p.hoursCompleted} max={p.capacityHours} caption={`${formatHours(p.hoursCompleted)} completed of ${formatHours(p.capacityHours)} capacity`} />
                <Stack direction="row" spacing={3} sx={{ mt: 1.5 }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
                      Budget remaining
                    </Typography>
                    <Typography sx={{ fontWeight: 600, color: Number(p.budgetRemaining) < 0 ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(p.budgetRemaining)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
                      Open milestones
                    </Typography>
                    <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      <Link component={RouterLink} to={`/projects/${p.id}?tab=milestones`} underline="hover" color="inherit" onClick={stop} aria-label={`${p.milestoneCounts.open} open milestones`}>
                        {p.milestoneCounts.open}
                      </Link>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        · {p.milestoneCounts.complete} complete
                      </Typography>
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
          <Typography variant="h6" component="h2">
            Your team
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Week of {formatDate(week.start)} – {formatDate(week.end)}
          </Typography>
        </Stack>
        <DataTable
          columns={TEAM_COLUMNS}
          rows={team}
          getRowKey={(t) => t.user.id}
          emptyMessage="No one reports to you yet."
          onRowClick={(t) => navigate(`/users/${t.user.id}`)}
          size="small"
        />
      </Box>
    </Stack>
  )
}

ManagerDashboard.propTypes = {
  data: PropTypes.shape({
    projects: PropTypes.array.isRequired,
    team: PropTypes.array.isRequired,
    week: PropTypes.shape({ start: PropTypes.string, end: PropTypes.string }).isRequired,
  }).isRequired,
}
