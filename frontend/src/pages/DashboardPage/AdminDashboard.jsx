import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DataTable from '../../components/DataTable/DataTable.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

const REASON = {
  over_budget: { label: 'Over budget', tone: 'error' },
  past_end: { label: 'Past end date', tone: 'warning' },
  overdue_milestone: { label: 'Overdue milestone', tone: 'error' },
  no_members: { label: 'No members', tone: 'warning' },
  no_milestones: { label: 'No milestones', tone: 'info' },
}

const ACTIVITY_COLUMNS = [
  { key: 'occurredAt', label: 'When', nowrap: true, render: (e) => formatDateTime(e.occurredAt) },
  {
    key: 'actor',
    label: 'Who',
    nowrap: true,
    render: (e) =>
      e.actor ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <span>{fullName(e.actor)}</span>
          <RoleChip role={e.actor.role} />
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          {e.actorRole ?? 'System'}
        </Typography>
      ),
  },
  { key: 'action', label: 'Action', nowrap: true, render: (e) => <Tag label={e.action} tone={e.statusCode < 400 ? 'neutral' : 'error'} /> },
  { key: 'summary', label: 'Summary' },
]

const COLUMNS = [
  { key: 'name', label: 'Project' },
  {
    key: 'reasons',
    label: 'Why',
    render: (p) => (
      <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
        {p.reasons.map((r) => (
          <Tag key={r} label={REASON[r].label} tone={REASON[r].tone} />
        ))}
      </Stack>
    ),
  },
  { key: 'budgetRemaining', label: 'Budget remaining', align: 'right', render: (p) => formatMoney(p.budgetRemaining) },
  { key: 'endDate', label: 'End date', render: (p) => formatDate(p.endDate) },
]

/** Admin landing: counts across the office and the projects that need a look (ui-flow.md › Per-role landing). */
export default function AdminDashboard({ data }) {
  const navigate = useNavigate()
  const { stats, attention, recentActivity } = data
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
        <StatCard label="Active projects" value={stats.activeProjects} hint={`${stats.completeProjects} complete · ${stats.archivedProjects} archived`} />
        <StatCard label="Managers" value={stats.users.manager} hint={`${stats.users.admin} admin${stats.users.admin === 1 ? '' : 's'}`} />
        <StatCard label="Employees" value={stats.users.employee} hint="Active accounts" />
        <StatCard
          label="Available"
          value={stats.availableEmployees}
          hint="Employees not on a project · open list"
          to="/users?available=true"
          color={stats.availableEmployees > 0 ? 'success.main' : 'text.primary'}
        />
      </Box>
      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Needs attention
        </Typography>
        {attention.length === 0 ? (
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Every active project is within budget and on schedule.
            </Typography>
          </Paper>
        ) : (
          <DataTable columns={COLUMNS} rows={attention} getRowKey={(p) => p.id} onRowClick={(p) => navigate(`/projects/${p.id}`)} size="small" />
        )}
      </Box>
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
          <Typography variant="h6" component="h2">
            Recent activity
          </Typography>
          <Button size="small" onClick={() => navigate('/audit-log')}>
            View all
          </Button>
        </Stack>
        <DataTable columns={ACTIVITY_COLUMNS} rows={recentActivity} getRowKey={(e) => e.id} emptyMessage="Nothing recorded yet." size="small" />
      </Box>
    </Stack>
  )
}

AdminDashboard.propTypes = {
  data: PropTypes.shape({
    stats: PropTypes.object.isRequired,
    attention: PropTypes.array.isRequired,
    recentActivity: PropTypes.array.isRequired,
  }).isRequired,
}
