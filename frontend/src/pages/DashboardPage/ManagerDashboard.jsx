import PropTypes from 'prop-types'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import DataTable from '../../components/DataTable/DataTable.jsx'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import { formatDate, formatHours, formatMoney } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

const REASON = {
  over_budget: { label: 'Over budget', tone: 'error' },
  past_end: { label: 'Past end date', tone: 'warning' },
  overdue_milestone: { label: 'Overdue milestone', tone: 'error' },
  no_members: { label: 'No members', tone: 'warning' },
  no_milestones: { label: 'No milestones', tone: 'info' },
}

/** Inner links on a clickable card or row: let the link navigate without the row also firing. */
const stop = (e) => e.stopPropagation()

const TEAM_COLUMNS = [
  { key: 'name', label: 'Name', nowrap: true, render: (t) => fullName(t.user) },
  { key: 'jobTitle', label: 'Job title', render: (t) => t.user.jobTitle },
  {
    key: 'currentProject',
    label: 'Current project',
    render: (t) => (t.currentProject ? t.currentProject.name : <Tag label="Available" tone="success" />),
  },
  {
    key: 'currentMilestone',
    label: 'Current milestone',
    render: (t) =>
      t.currentMilestone ? (
        <Link component={RouterLink} to={`/milestones/${t.currentMilestone.id}`} underline="hover" color="inherit" onClick={stop}>
          {t.currentMilestone.name}
        </Link>
      ) : (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      ),
  },
  {
    key: 'hoursThisWeek',
    label: 'Hours this week',
    align: 'right',
    // on a project but nothing logged this week: worth a nudge
    render: (t) => (t.currentProject && Number(t.hoursThisWeek) === 0 ? <Tag label="0 h" tone="warning" /> : formatHours(t.hoursThisWeek)),
  },
]

const DUE_SOON_COLUMNS = [
  {
    key: 'name',
    label: 'Milestone',
    render: (m) => (
      <Link component={RouterLink} to={`/milestones/${m.id}`} underline="hover" color="inherit" sx={{ fontWeight: 500 }} onClick={stop}>
        {m.name}
      </Link>
    ),
  },
  { key: 'project', label: 'Project', render: (m) => m.project.name },
  {
    key: 'dueDate',
    label: 'Due',
    nowrap: true,
    render: (m) => (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <span>{formatDate(m.dueDate)}</span>
        <DueTag dueDate={m.dueDate} />
      </Stack>
    ),
  },
  {
    key: 'assignees',
    label: 'Who',
    render: (m) =>
      m.assignees.length === 0 ? (
        <Tag label="Unassigned" tone="warning" />
      ) : (
        <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
          {m.assignees.map((a) => (
            <Tag key={a.id} label={fullName(a)} />
          ))}
        </Stack>
      ),
  },
]

/** Manager landing: one card per managed project and the team's availability (ui-flow.md › Per-role landing). */
export default function ManagerDashboard({ data }) {
  const navigate = useNavigate()
  const { projects, dueSoon, team, week } = data
  return (
    <Stack spacing={3}>
      <Box>
        <SectionHeading icon={<FolderOutlinedIcon />} title="Your projects" />
        {projects.length === 0 ? (
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              You are not managing any projects yet. An admin assigns projects to managers.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: projects.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
            {projects.map((p) => (
              <Paper
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                sx={{ p: 2.5, display: 'block', cursor: 'pointer', '&:hover': { borderColor: 'text.secondary' } }}
              >
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Link component={RouterLink} to={`/projects/${p.id}`} underline="hover" color="inherit" sx={{ fontWeight: 600, display: 'block', overflowWrap: 'anywhere' }} onClick={stop}>
                      {p.name}
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(p.startDate)} – {formatDate(p.endDate)} ·{' '}
                      <Link component={RouterLink} to={`/projects/${p.id}?tab=members`} underline="hover" color="inherit" onClick={stop}>
                        {p.memberCount} member{p.memberCount === 1 ? '' : 's'}
                      </Link>
                    </Typography>
                  </Box>
                  <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                    <StatusChip status={p.status} />
                    {p.reasons.map((r) => (
                      <Tag key={r} label={REASON[r].label} tone={REASON[r].tone} />
                    ))}
                  </Stack>
                </Stack>
                <ProgressBar value={p.hoursCompleted} max={p.capacityHours} caption={`${formatHours(p.hoursCompleted)} completed of ${formatHours(p.capacityHours)} capacity`} />
                <Stack direction="row" useFlexGap spacing={3} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
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
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {p.milestoneCounts.complete} complete
                    </Typography>
                  </Box>
                  {p.nextDueDate && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
                        Next due
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatDate(p.nextDueDate)}</Typography>
                        <DueTag dueDate={p.nextDueDate} />
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
      <Box>
        <SectionHeading
          icon={<EventOutlinedIcon />}
          title="Due soon"
          aside={
            <Typography variant="caption" color="text.secondary">
              Open milestones overdue or due within 7 days
            </Typography>
          }
        />
        {dueSoon.length === 0 ? (
          <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckCircleOutlinedIcon sx={{ color: 'success.main' }} />
            <Typography variant="body2" color="text.secondary">
              Nothing is overdue or due in the next 7 days.
            </Typography>
          </Paper>
        ) : (
          <DataTable columns={DUE_SOON_COLUMNS} rows={dueSoon} getRowKey={(m) => m.id} onRowClick={(m) => navigate(`/milestones/${m.id}`)} size="small" />
        )}
      </Box>
      <Box>
        <SectionHeading
          icon={<GroupsOutlinedIcon />}
          title="Your team"
          aside={
            <Typography variant="caption" color="text.secondary">
              Week of {formatDate(week.start)} – {formatDate(week.end)}
            </Typography>
          }
        />
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
    dueSoon: PropTypes.array.isRequired,
    team: PropTypes.array.isRequired,
    week: PropTypes.shape({ start: PropTypes.string, end: PropTypes.string }).isRequired,
  }).isRequired,
}
