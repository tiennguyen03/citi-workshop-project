import { useState } from 'react'
import PropTypes from 'prop-types'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import * as milestonesApi from '../../services/milestones.js'
import { formatDate, formatHours } from '../../utils/format.js'
import TimeEntryDialog from '../ProjectDetailPage/TimeEntryDialog.jsx'

/** The working week every employee is measured against (requirements.md: 40-hour week). */
const HOURS_PER_WEEK = 40

const PAST_COLUMNS = [
  { key: 'name', label: 'Project' },
  { key: 'status', label: 'Status', render: (p) => <StatusChip status={p.status} /> },
  { key: 'dates', label: 'Dates', nowrap: true, render: (p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` },
]

/** Employee landing: current project, open goals with checkboxes, log time, past projects (ui-flow.md › F6). */
export default function EmployeeDashboard({ data, onChanged, notify }) {
  const navigate = useNavigate()
  const [logging, setLogging] = useState(false)
  const [ticked, setTicked] = useState({})
  const { currentProject: current, openGoals, pastProjects, hoursThisWeek, week } = data
  const weekHours = Number(hoursThisWeek)
  const overWeek = weekHours > HOURS_PER_WEEK

  async function tick(goal) {
    setTicked((t) => ({ ...t, [goal.id]: true }))
    try {
      await milestonesApi.updateGoal(goal.id, { isDone: true })
      notify(`Done: ${goal.title}`)
      onChanged()
    } catch (err) {
      setTicked((t) => ({ ...t, [goal.id]: false }))
      notify(err.message, 'error')
    }
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="overline" color="text.secondary">
            My current project
          </Typography>
          {current ? (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5, mb: 0.5 }}>
                <Link component={RouterLink} to={`/projects/${current.id}`} underline="hover" color="inherit" variant="h5">
                  {current.name}
                </Link>
                <StatusChip status={current.status} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {formatDate(current.startDate)} – {formatDate(current.endDate)}
                {current.currentMilestone ? (
                  <>
                    {' · now on '}
                    <Link component={RouterLink} to={`/milestones/${current.currentMilestone.id}`} underline="hover">
                      {current.currentMilestone.name}
                    </Link>
                  </>
                ) : (
                  ' · no open milestone assigned'
                )}
              </Typography>
              <ProgressBar
                value={current.myHoursCompleted}
                max={current.myHoursAssigned}
                caption={`${formatHours(current.myHoursCompleted)} logged of ${formatHours(current.myHoursAssigned)} assigned to you`}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogging(true)}>
                  Log time
                </Button>
                <Button variant="outlined" onClick={() => navigate(`/projects/${current.id}`)}>
                  Open project
                </Button>
              </Stack>
            </>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Tag label="Available" tone="success" size="medium" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                You are not assigned to a project right now. Your manager can add you to one when it starts.
              </Typography>
            </Box>
          )}
        </Paper>
        <StatCard
          label="Hours this week"
          value={formatHours(weekHours)}
          color={overWeek ? 'warning.main' : 'text.primary'}
          hint={`${formatDate(week.start)} – ${formatDate(week.end)}`}
          footer={
            <ProgressBar
              value={weekHours}
              max={HOURS_PER_WEEK}
              color={overWeek ? 'warning' : 'primary'}
              caption={overWeek ? `${formatHours(weekHours)} of ${HOURS_PER_WEEK} h · over the ${HOURS_PER_WEEK}-hour week` : `${formatHours(weekHours)} of ${HOURS_PER_WEEK} h`}
            />
          }
        />
      </Box>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
          <Typography variant="h6" component="h2">
            My open goals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {openGoals.length === 0 ? 'All clear' : `${openGoals.length} open`}
          </Typography>
        </Stack>
        {openGoals.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing assigned to you on an open milestone.
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {openGoals.map((g) => (
              <Box
                component="li"
                key={g.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderTop: '1px solid', borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}
              >
                <Checkbox
                  size="small"
                  checked={Boolean(ticked[g.id])}
                  disabled={Boolean(ticked[g.id])}
                  onChange={() => tick(g)}
                  slotProps={{ input: { 'aria-label': `Complete goal ${g.title}` } }}
                />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography>{g.title}</Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">
                      <Link component={RouterLink} to={`/milestones/${g.milestone.id}`} underline="hover" color="inherit">
                        {g.milestone.name}
                      </Link>
                      {' · due '}
                      {formatDate(g.milestone.dueDate)}
                    </Typography>
                    <DueTag dueDate={g.milestone.dueDate} />
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {pastProjects.length > 0 && (
        <Box>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            Past projects
          </Typography>
          <DataTable columns={PAST_COLUMNS} rows={pastProjects} getRowKey={(p) => p.id} onRowClick={(p) => navigate(`/projects/${p.id}`)} size="small" />
        </Box>
      )}

      {current && (
        <TimeEntryDialog
          key={`log-${logging}`}
          open={logging}
          project={current}
          onClose={() => setLogging(false)}
          onSaved={(saved) => {
            setLogging(false)
            notify(`Logged ${formatHours(saved.hours)} on ${current.name}`)
            onChanged()
          }}
        />
      )}
    </Stack>
  )
}

EmployeeDashboard.propTypes = {
  data: PropTypes.shape({
    currentProject: PropTypes.object,
    openGoals: PropTypes.array.isRequired,
    pastProjects: PropTypes.array.isRequired,
    hoursThisWeek: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    week: PropTypes.shape({ start: PropTypes.string, end: PropTypes.string }).isRequired,
  }).isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
}
