import { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import StatusChip from '../../components/StatusChip/StatusChip.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import * as milestonesApi from '../../services/milestones.js'
import { formatDate } from '../../utils/format.js'
import { fullName, initials } from '../../utils/roles.js'
import MilestoneDialog from './MilestoneDialog.jsx'

const COLUMNS = [
  {
    key: 'name',
    label: 'Milestone',
    render: (m) => (
      <>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {m.name}
        </Typography>
        {m.description && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 360 }}>
            {m.description}
          </Typography>
        )}
      </>
    ),
  },
  { key: 'status', label: 'Status', render: (m) => <StatusChip status={m.status} /> },
  { key: 'dates', label: 'Dates', nowrap: true, render: (m) => `${formatDate(m.startDate)} – ${formatDate(m.dueDate)}` },
  {
    key: 'goals',
    label: 'Goals',
    render: (m) =>
      m.goalsTotal === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No goals yet
        </Typography>
      ) : (
        <ProgressBar value={m.goalsDone} max={m.goalsTotal} caption={`${m.goalsDone} of ${m.goalsTotal} done`} />
      ),
  },
  {
    key: 'assignees',
    label: 'Assignees',
    render: (m) =>
      m.assignees.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Unassigned
        </Typography>
      ) : (
        <AvatarGroup max={4} sx={{ justifyContent: 'flex-end', '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.6875rem' } }}>
          {m.assignees.map((a) => (
            <Tooltip key={a.id} title={fullName(a)}>
              <Avatar sx={{ bgcolor: 'action.selected', color: 'text.primary' }}>{initials(a)}</Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      ),
  },
]

/** Ordered milestone list with goal progress; managers can add milestones (ui-flow.md F5). */
export default function MilestonesTab({ project, canManage, onChanged, notify }) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const writable = canManage && !project.archived && project.status === 'active'

  const { data, loading, error, refetch } = useApi(() => milestonesApi.list(project.id), [project.id])
  const { data: people, refetch: refetchPeople } = useApi(
    () => (canManage && !project.archived ? milestonesApi.availableAssignees(project.id) : Promise.resolve(null)),
    [project.id, canManage, project.archived],
  )
  const rows = data?.items ?? []

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          {rows.length === 0 ? 'Break the project into phases, each with its own goals and people.' : 'Click a milestone to manage its goals.'}
        </Typography>
        {writable && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            New milestone
          </Button>
        )}
      </Stack>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(m) => m.id}
        loading={loading}
        emptyMessage="No milestones yet."
        onRowClick={(m) => navigate(`/milestones/${m.id}`)}
        size="small"
      />
      {people && (people.items.length > 0 || people.busy.length > 0) && (
        <Paper sx={{ p: 2.5, mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Who is on what
          </Typography>
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
            {people.busy.map((b) => (
              <Tag key={b.user.id} tone="info" label={`${fullName(b.user)} · ${b.milestone.name}`} />
            ))}
            {people.items.map((p) => (
              <Tag key={p.id} tone="success" label={`${fullName(p)} · available`} />
            ))}
          </Stack>
        </Paper>
      )}
      {writable && (
        <MilestoneDialog
          key={`new-${creating}`}
          open={creating}
          project={project}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false)
            notify(`Created milestone '${saved.name}'`)
            refetch()
            refetchPeople()
            onChanged()
          }}
        />
      )}
    </>
  )
}

MilestonesTab.propTypes = {
  project: PropTypes.object.isRequired,
  canManage: PropTypes.bool.isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
}
