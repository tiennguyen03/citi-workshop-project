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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import useAuth from '../../auth/useAuth.js'
import ActionIconButton from '../../components/ActionIconButton/ActionIconButton.jsx'
import DataTable from '../../components/DataTable/DataTable.jsx'
import DueTag from '../../components/DueTag/DueTag.jsx'
import FieldList from '../../components/FieldList/FieldList.jsx'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import SummaryRow from '../../components/SummaryRow/SummaryRow.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import * as milestonesApi from '../../services/milestones.js'
import { formatDate, formatHours, formatRatio } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'
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
  const { user: me } = useAuth()
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(null)
  const [ticked, setTicked] = useState({})
  const { currentProject: current, openGoals, pastProjects, recentEntries, hoursThisWeek, week } = data
  const milestone = current?.currentMilestone
  const teammates = milestone ? milestone.assignees.filter((a) => a.id !== me.id) : []

  const ENTRY_COLUMNS = [
    { key: 'entryDate', label: 'Date', nowrap: true, render: (e) => formatDate(e.entryDate), width: 140 },
    { key: 'hours', label: 'Hours', numeric: true, render: (e) => formatHours(e.hours), width: 90 },
    { key: 'note', label: 'Note', render: (e) => e.note || <Typography variant="caption" color="text.secondary">—</Typography> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 56,
      render: (e) => (
        <ActionIconButton label="Edit time entry" aria-label={`Edit time entry on ${formatDate(e.entryDate)}`} onClick={() => setEditing(e)}>
          <EditOutlinedIcon fontSize="small" />
        </ActionIconButton>
      ),
    },
  ]
  const weekHours = Number(hoursThisWeek)
  const overWeek = weekHours > HOURS_PER_WEEK
  const myPct = current && Number(current.myHoursAssigned) > 0 ? Math.round((Number(current.myHoursCompleted) / Number(current.myHoursAssigned)) * 100) : 0

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
      {/* Three questions, three places (D25): what am I on, how far am I, how much this week. Each has its one action. */}
      <Box sx={{ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: { xs: '1fr', md: current ? 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
        <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
            Current project
          </Typography>
          {current ? (
            <>
              <Stack direction="row" useFlexGap spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                <Link component={RouterLink} to={`/projects/${current.id}`} underline="hover" color="inherit" variant="h5">
                  {current.name}
                </Link>
                <StatusChip status={current.status} />
              </Stack>
              <Box sx={{ mt: 2, flexGrow: 1 }}>
                <FieldList
                  columns={1}
                  items={[
                    {
                      label: 'Current milestone',
                      value: milestone ? (
                        <Link component={RouterLink} to={`/milestones/${milestone.id}`} underline="hover" color="inherit">
                          {milestone.name}
                        </Link>
                      ) : (
                        'None assigned to you yet'
                      ),
                    },
                    ...(milestone
                      ? [
                          {
                            label: 'Due',
                            value: (
                              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <span>{milestone.dueDate ? formatDate(milestone.dueDate) : '—'}</span>
                                <DueTag dueDate={milestone.dueDate} />
                              </Stack>
                            ),
                          },
                          {
                            label: 'Working with',
                            value:
                              teammates.length === 0 ? (
                                'Just you on this milestone'
                              ) : (
                                <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                                  {teammates.map((a) => (
                                    <Tag key={a.id} label={fullName(a)} variant="quiet" />
                                  ))}
                                </Stack>
                              ),
                          },
                        ]
                      : []),
                    { label: 'Runs', value: `${formatDate(current.startDate)} – ${formatDate(current.endDate)}` },
                  ]}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" onClick={() => navigate(`/projects/${current.id}`)}>
                  Open project
                </Button>
              </Box>
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
        {current && (
          <StatCard
            icon={<TaskAltOutlinedIcon />}
            label="My progress"
            value={`${myPct}%`}
            hint={`${formatRatio(current.myHoursCompleted, current.myHoursAssigned)} assigned to you`}
            progress={{ value: current.myHoursCompleted, max: current.myHoursAssigned, kind: 'completion', caption: formatRatio(current.myHoursCompleted, current.myHoursAssigned) }}
          />
        )}
        <StatCard
          icon={<ScheduleOutlinedIcon />}
          label="This week"
          value={formatRatio(weekHours, HOURS_PER_WEEK)}
          color={overWeek ? 'warning.main' : 'text.primary'}
          hint={overWeek ? `Over the ${HOURS_PER_WEEK}-hour week, ${formatDate(week.start)} – ${formatDate(week.end)}` : `${formatDate(week.start)} – ${formatDate(week.end)}`}
          progress={{ value: weekHours, max: HOURS_PER_WEEK, color: overWeek ? 'warning' : 'primary', caption: formatRatio(weekHours, HOURS_PER_WEEK) }}
          action={
            current ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogging(true)}>
                Log time
              </Button>
            ) : null
          }
        />
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <SectionHeading
          icon={<TaskAltOutlinedIcon />}
          title="My open goals"
          sx={{ mb: 1 }}
          description={openGoals.length === 0 ? 'All clear' : <SummaryRow items={[{ key: 'open', value: openGoals.length, label: openGoals.length === 1 ? 'open goal' : 'open goals' }]} />}
        />
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
                sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}
              >
                <Checkbox
                  size="small"
                  checked={Boolean(ticked[g.id])}
                  disabled={Boolean(ticked[g.id])}
                  onChange={() => tick(g)}
                  slotProps={{ input: { 'aria-label': `Complete goal ${g.title}` } }}
                />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2">{g.title}</Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">
                      <Link component={RouterLink} to={`/milestones/${g.milestone.id}`} underline="hover" color="inherit">
                        {g.milestone.name}
                      </Link>
                      {', due '}
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

      {current && (
        <Box>
          <SectionHeading
            icon={<ReceiptLongOutlinedIcon />}
            title="Recent entries"
            aside={
              <Button size="small" component={RouterLink} to={`/projects/${current.id}?tab=time`}>
                All my time
              </Button>
            }
          />
          <DataTable columns={ENTRY_COLUMNS} rows={recentEntries} getRowKey={(e) => e.id} emptyMessage="Nothing logged yet on this project." size="small" />
        </Box>
      )}

      {pastProjects.length > 0 && (
        <Box>
          <SectionHeading icon={<HistoryOutlinedIcon />} title="Past projects" />
          <DataTable columns={PAST_COLUMNS} rows={pastProjects} getRowKey={(p) => p.id} onRowClick={(p) => navigate(`/projects/${p.id}`)} size="small" />
        </Box>
      )}

      {current && editing && (
        <TimeEntryDialog
          open
          project={current}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            notify('Time entry updated')
            onChanged()
          }}
        />
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
    recentEntries: PropTypes.array.isRequired,
    hoursThisWeek: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    week: PropTypes.shape({ start: PropTypes.string, end: PropTypes.string }).isRequired,
  }).isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
}
