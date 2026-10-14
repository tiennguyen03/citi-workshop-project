import PropTypes from 'prop-types'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import DataTable from '../../components/DataTable/DataTable.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import HealthTag from '../../components/HealthTag/HealthTag.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import RoleChip from '../../components/RoleChip/RoleChip.jsx'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import { actionLabel } from '../../utils/auditActions.js'
import { formatDate, formatDateTime, formatHours, formatMoney } from '../../utils/format.js'
import { REASON, summarizeHealth } from '../../utils/projectHealth.js'
import { fullName } from '../../utils/roles.js'

/** Inner links on a clickable row: let the link navigate without the row also firing. */
const stop = (e) => e.stopPropagation()

const BOARD_COLUMNS = [
  {
    key: 'name',
    label: 'Project',
    render: (p) => (
      <>
        <Link component={RouterLink} to={`/projects/${p.id}`} underline="hover" color="inherit" sx={{ fontWeight: 500 }} onClick={stop}>
          {p.name}
        </Link>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {fullName(p.manager)}
        </Typography>
      </>
    ),
  },
  {
    key: 'health',
    label: 'Health',
    render: (p) => (
      <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <HealthTag health={p.health} />
        {p.reasons.map((r) => (
          <Tag key={r} label={REASON[r]?.label ?? r} tone={REASON[r]?.tone ?? 'neutral'} />
        ))}
      </Stack>
    ),
  },
  {
    key: 'progress',
    label: 'Progress',
    nowrap: true,
    render: (p) => <ProgressBar value={p.hoursCompleted} max={p.capacityHours} caption={`${formatHours(p.hoursCompleted)} of ${formatHours(p.capacityHours)}`} />,
  },
  {
    key: 'budgetRemaining',
    label: 'Budget left',
    align: 'right',
    nowrap: true,
    render: (p) => (
      <Typography variant="body2" sx={{ color: Number(p.budgetRemaining) < 0 ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
        {formatMoney(p.budgetRemaining)}
      </Typography>
    ),
  },
  {
    key: 'nextDueDate',
    label: 'Next due',
    nowrap: true,
    render: (p) =>
      p.nextDueDate ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <span>{formatDate(p.nextDueDate)}</span>
          <DueTag dueDate={p.nextDueDate} isOpen={p.status === 'active'} />
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      ),
  },
  {
    key: 'endDate',
    label: 'Ends',
    nowrap: true,
    render: (p) => (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <span>{formatDate(p.endDate)}</span>
        <DueTag dueDate={p.endDate} isOpen={p.status === 'active'} soonDays={14} overdueLabel="Past end" overdueTone="warning" />
      </Stack>
    ),
  },
]

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
  { key: 'action', label: 'Action', nowrap: true, render: (e) => <Tag label={actionLabel(e.action)} tone={e.statusCode < 400 ? 'neutral' : 'error'} /> },
  { key: 'summary', label: 'Summary' },
]

/**
 * Admin landing: the portfolio in one screen (ui-flow.md › Per-role landing). Three pillar tiles (time, cost,
 * people), the project health board sorted worst first by the API, and the latest audit rows.
 */
export default function AdminDashboard({ data }) {
  const navigate = useNavigate()
  const { projects, summary, people, recentActivity } = data
  const overBudget = Number(summary.costConsumed) > Number(summary.budget)
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        <StatCard
          icon={<ScheduleOutlinedIcon />}
          label="Hours logged"
          value={formatHours(summary.hoursCompleted)}
          hint={`of ${formatHours(summary.capacityHours)} capacity on active projects`}
          footer={<ProgressBar value={summary.hoursCompleted} max={summary.capacityHours} caption={`${formatHours(summary.hoursCompleted)} of ${formatHours(summary.capacityHours)}`} />}
        />
        <StatCard
          icon={<AccountBalanceWalletOutlinedIcon />}
          label="Budget consumed"
          value={formatMoney(summary.costConsumed)}
          color={overBudget ? 'error.main' : 'text.primary'}
          hint={`of ${formatMoney(summary.budget)} planned on active projects`}
          footer={<ProgressBar value={summary.costConsumed} max={summary.budget} caption={`${formatMoney(summary.costConsumed)} of ${formatMoney(summary.budget)}`} />}
        />
        <StatCard
          icon={<EventAvailableOutlinedIcon />}
          label="People"
          value={`${people.available} available`}
          color={people.available > 0 ? 'success.main' : 'text.primary'}
          hint={`of ${people.employees} employee${people.employees === 1 ? '' : 's'}, ${people.onProject} on a project. Open the list`}
          to="/users?available=true"
        />
      </Box>
      <Box>
        <SectionHeading
          icon={<MonitorHeartOutlinedIcon />}
          title="Project health"
          sx={{ flexWrap: 'wrap' }}
          aside={
            <Typography variant="caption" color="text.secondary">
              {summarizeHealth(summary.projects)}
            </Typography>
          }
        />
        <DataTable
          columns={BOARD_COLUMNS}
          rows={projects}
          getRowKey={(p) => p.id}
          emptyMessage="No projects yet. Create one to start the board."
          onRowClick={(p) => navigate(`/projects/${p.id}`)}
          size="small"
        />
      </Box>
      <Box>
        <SectionHeading
          icon={<HistoryOutlinedIcon />}
          title="Recent activity"
          aside={
            <Button size="small" onClick={() => navigate('/audit-log')}>
              View all
            </Button>
          }
        />
        <DataTable columns={ACTIVITY_COLUMNS} rows={recentActivity} getRowKey={(e) => e.id} emptyMessage="Nothing recorded yet." size="small" />
      </Box>
    </Stack>
  )
}

AdminDashboard.propTypes = {
  data: PropTypes.shape({
    projects: PropTypes.array.isRequired,
    summary: PropTypes.object.isRequired,
    people: PropTypes.object.isRequired,
    recentActivity: PropTypes.array.isRequired,
  }).isRequired,
}
