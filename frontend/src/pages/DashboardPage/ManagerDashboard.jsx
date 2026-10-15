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
import ProjectCard from '../../components/ProjectCard/ProjectCard.jsx'
import SummaryRow from '../../components/SummaryRow/SummaryRow.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import { formatDate, formatHours } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

/** The 40-hour week each report is measured against (requirements.md). */
const HOURS_PER_WEEK = 40

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
  const onProject = team.filter((t) => t.currentProject)
  const teamHours = onProject.reduce((total, t) => total + Number(t.hoursThisWeek), 0)
  return (
    <Stack spacing={3}>
      <Box>
        <SectionHeading icon={<FolderOutlinedIcon />} title="Your projects" />
        {/* cards sit two to a row; a lone card takes the whole row rather than leaving an empty slot */}
        {projects.length === 0 ? (
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              You are not managing any projects yet. An admin assigns projects to managers.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: projects.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' } }}>
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </Box>
        )}
      </Box>
      <Box>
        <SectionHeading icon={<EventOutlinedIcon />} title="Due soon" description="Open milestones overdue or due within 7 days" />
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
          description={
            <SummaryRow
              aria-label="Team hours this week"
              items={[
                ...(onProject.length > 0
                  ? [
                      { key: 'logged', value: formatHours(teamHours), label: 'logged this week', tone: teamHours === 0 ? 'warning' : 'success' },
                      { key: 'capacity', value: formatHours(onProject.length * HOURS_PER_WEEK), label: `capacity for ${onProject.length} on a project` },
                    ]
                  : []),
                { key: 'week', value: `${formatDate(week.start)} – ${formatDate(week.end)}`, label: 'this week' },
              ]}
            />
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
