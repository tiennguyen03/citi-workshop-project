import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DataTable from '../../components/DataTable/DataTable.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import { formatDate, formatMoney } from '../../utils/format.js'

const REASON = {
  over_budget: { label: 'Over budget', tone: 'error' },
  past_end: { label: 'Past end date', tone: 'warning' },
}

const COLUMNS = [
  { key: 'name', label: 'Project' },
  {
    key: 'reasons',
    label: 'Why',
    render: (p) => (
      <Stack direction="row" spacing={0.75}>
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
  const { stats, attention } = data
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
    </Stack>
  )
}

AdminDashboard.propTypes = {
  data: PropTypes.shape({
    stats: PropTypes.object.isRequired,
    attention: PropTypes.array.isRequired,
  }).isRequired,
}
