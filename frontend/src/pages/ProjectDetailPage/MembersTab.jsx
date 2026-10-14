import { useState } from 'react'
import PropTypes from 'prop-types'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import PersonRemoveIcon from '@mui/icons-material/PersonRemove'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx'
import DataTable from '../../components/DataTable/DataTable.jsx'
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert.jsx'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import ProgressBar from '../../components/ProgressBar/ProgressBar.jsx'
import Tag from '../../components/Tag/Tag.jsx'
import useApi from '../../hooks/useApi.js'
import * as projectsApi from '../../services/projects.js'
import { formatHours, formatMoney } from '../../utils/format.js'
import { fullName } from '../../utils/roles.js'

function HoursDialog({ open, title, submitLabel, initialHours, capacity, assignedSoFar, projectCapacity, options, onClose, onSubmit }) {
  const [userId, setUserId] = useState('')
  const [hours, setHours] = useState(initialHours === undefined ? '' : String(initialHours))
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [pending, setPending] = useState(false)
  const needsUser = Boolean(options)
  const wouldBeAssigned = Number(assignedSoFar) + (Number(hours) || 0)
  const overCapacity = Number(projectCapacity) > 0 && wouldBeAssigned > Number(projectCapacity)

  async function submit() {
    const value = Number(hours)
    if (needsUser && !userId) {
      setFieldError({ userId: 'Choose an employee' })
      return
    }
    if (hours === '' || Number.isNaN(value) || value < 0 || value > Number(capacity)) {
      setFieldError({ hours: `Enter 0 to ${capacity} hours` })
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSubmit({ userId, hoursAssigned: value })
      setUserId('')
      setHours('0')
      setFieldError(null)
    } catch (err) {
      if (err.details?.field === 'userId') setFieldError({ userId: err.message })
      else if (err.details?.field === 'hoursAssigned') setFieldError({ hours: err.message })
      else setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog open={open} title={title} onClose={onClose} onSubmit={submit} submitLabel={submitLabel} pending={pending} error={error} maxWidth="xs">
      {needsUser && (
        <TextField
          select
          label="Employee"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          error={Boolean(fieldError?.userId)}
          helperText={fieldError?.userId ?? (options.length === 0 ? 'No available employees — everyone is already on a project.' : 'Only employees not on another active project are listed.')}
          disabled={pending || options.length === 0}
          required
        >
          {options.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {fullName(u)}, {u.jobTitle}
            </MenuItem>
          ))}
        </TextField>
      )}
      <TextField
        label="Hours assigned"
        type="number"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        error={Boolean(fieldError?.hours)}
        helperText={fieldError?.hours ?? `Capacity per member for these dates: ${formatHours(capacity)}`}
        disabled={pending}
        slotProps={{ htmlInput: { min: 0, max: capacity, step: 0.25 } }}
        required
      />
      <Typography variant="caption" color="text.secondary">
        Project so far: {formatHours(assignedSoFar)} assigned of {formatHours(projectCapacity)} capacity{needsUser ? ' (after adding this member)' : ''}.
      </Typography>
      {overCapacity && (
        <Alert severity="warning">
          This would bring assigned hours to {formatHours(wouldBeAssigned)}, above the project capacity of {formatHours(projectCapacity)}. You can still save it.
        </Alert>
      )}
    </FormDialog>
  )
}
HoursDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.node.isRequired,
  submitLabel: PropTypes.node.isRequired,
  initialHours: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  capacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  assignedSoFar: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  projectCapacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  options: PropTypes.arrayOf(PropTypes.object),
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

/** Team table with add / edit hours / release (ui-flow.md F4). */
export default function MembersTab({ project, canManage, onChanged, notify }) {
  const [showReleased, setShowReleased] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [releasing, setReleasing] = useState(null)
  const [pending, setPending] = useState(false)
  const writable = canManage && !project.archived && project.status === 'active'

  const { data, loading, error, refetch } = useApi(() => projectsApi.members(project.id, showReleased), [project.id, showReleased])
  const { data: available, refetch: refetchAvailable } = useApi(
    () => (writable ? projectsApi.availableMembers(project.id) : Promise.resolve({ items: [] })),
    [project.id, writable],
  )
  const rows = data?.items ?? []
  const capacity = rows[0]?.capacityHours ?? 0
  const hasCosts = rows.some((m) => m.costConsumed !== undefined)

  const changed = () => {
    refetch()
    refetchAvailable()
    onChanged()
  }

  const columns = [
    { key: 'name', label: 'Name', nowrap: true, render: (m) => fullName(m.user) },
    { key: 'jobTitle', label: 'Job title', render: (m) => m.user.jobTitle },
    {
      key: 'currentMilestone',
      label: 'Current milestone',
      render: (m) =>
        m.currentMilestone ? (
          <Link component={RouterLink} to={`/milestones/${m.currentMilestone.id}`} underline="hover" color="inherit">
            {m.currentMilestone.name}
          </Link>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {m.isActive ? 'Free' : '—'}
          </Typography>
        ),
    },
    { key: 'hoursAssigned', label: 'Assigned', align: 'right', render: (m) => formatHours(m.hoursAssigned) },
    {
      key: 'hoursCompleted',
      label: 'Completed',
      render: (m) => <ProgressBar layout="inline" value={m.hoursCompleted} max={m.hoursAssigned} caption={`${formatHours(m.hoursCompleted)} of ${formatHours(m.hoursAssigned)}`} />,
    },
    ...(hasCosts ? [{ key: 'costConsumed', label: 'Cost consumed', align: 'right', render: (m) => formatMoney(m.costConsumed) }] : []),
    {
      key: 'isActive',
      label: 'Status',
      render: (m) => (m.isActive ? <Tag label="Active" tone="success" variant="quiet" /> : <Tag label={`Released (${m.releasedReason})`} tone="neutral" />),
    },
    ...(writable
      ? [
          {
            key: 'actions',
            label: '',
            align: 'right',
            render: (m) =>
              m.isActive ? (
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                  <Tooltip title="Edit assigned hours">
                    <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }} aria-label={`Edit hours for ${fullName(m.user)}`} onClick={(e) => { e.stopPropagation(); setEditing(m) }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Release from project">
                    <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }} aria-label={`Release ${fullName(m.user)}`} onClick={(e) => { e.stopPropagation(); setReleasing(m) }}>
                      <PersonRemoveIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : null,
          },
        ]
      : []),
  ]

  async function confirmRelease() {
    setPending(true)
    try {
      await projectsApi.removeMember(project.id, releasing.user.id)
      notify(`${fullName(releasing.user)} released — they are available for other projects`)
      setReleasing(null)
      changed()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <FormControlLabel control={<Switch checked={showReleased} onChange={(e) => setShowReleased(e.target.checked)} />} label="Show released members" />
        {writable && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            Add member
          </Button>
        )}
      </Stack>
      <ErrorAlert error={error} onRetry={refetch} />
      <DataTable columns={columns} rows={rows} getRowKey={(m) => m.user.id} loading={loading} emptyMessage="No one is on this project yet." size="small" />
      {writable && (
        <HoursDialog
          key={`add-${adding}`}
          open={adding}
          title="Add member"
          submitLabel="Add to project"
          capacity={project.capacityHoursPerMember ?? capacity}
          assignedSoFar={project.hoursAssigned}
          projectCapacity={Number(project.capacityHours) + Number(project.capacityHoursPerMember ?? capacity)}
          options={available?.items ?? []}
          onClose={() => setAdding(false)}
          onSubmit={async ({ userId, hoursAssigned }) => {
            const member = await projectsApi.addMember(project.id, { userId, hoursAssigned })
            notify(`Added ${fullName(member.user)}`)
            setAdding(false)
            changed()
          }}
        />
      )}
      {editing && (
        <HoursDialog
          open
          title={`Assigned hours — ${fullName(editing.user)}`}
          submitLabel="Save"
          initialHours={editing.hoursAssigned}
          capacity={editing.capacityHours}
          assignedSoFar={Number(project.hoursAssigned) - Number(editing.hoursAssigned)}
          projectCapacity={project.capacityHours}
          onClose={() => setEditing(null)}
          onSubmit={async ({ hoursAssigned }) => {
            await projectsApi.updateMember(project.id, editing.user.id, { hoursAssigned })
            notify('Hours updated')
            setEditing(null)
            changed()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(releasing)}
        title="Release from project?"
        message={
          releasing
            ? `${fullName(releasing.user)} will be released from this project and unassigned from its milestones and goals. Their logged hours are kept.`
            : ''
        }
        confirmLabel="Release"
        confirmColor="error"
        pending={pending}
        onConfirm={confirmRelease}
        onClose={() => setReleasing(null)}
      />
    </>
  )
}

MembersTab.propTypes = {
  project: PropTypes.object.isRequired,
  canManage: PropTypes.bool.isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
}
