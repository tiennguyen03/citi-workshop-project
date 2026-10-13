import { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import * as milestonesApi from '../../services/milestones.js'
import { fullName } from '../../utils/roles.js'

const UNASSIGNED = ''

function AssigneeSelect({ value, onChange, assignees, disabled, label = 'Assignee' }) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} sx={{ minWidth: 180 }}>
      <MenuItem value={UNASSIGNED}>
        <em>Unassigned</em>
      </MenuItem>
      {assignees.map((a) => (
        <MenuItem key={a.id} value={a.id}>
          {fullName(a)}
        </MenuItem>
      ))}
    </TextField>
  )
}
AssigneeSelect.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  assignees: PropTypes.array.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
}

function GoalEditDialog({ goal, assignees, onClose, onSaved }) {
  const [title, setTitle] = useState(goal.title)
  const [assigneeId, setAssigneeId] = useState(goal.assignee?.id ?? UNASSIGNED)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  async function submit() {
    if (!title.trim()) {
      setError('Enter a title')
      return
    }
    const changes = {}
    if (title.trim() !== goal.title) changes.title = title.trim()
    if ((goal.assignee?.id ?? UNASSIGNED) !== assigneeId) changes.assigneeId = assigneeId || null
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    setPending(true)
    try {
      onSaved(await milestonesApi.updateGoal(goal.id, changes))
    } catch (err) {
      setError(err.message)
      setPending(false)
    }
  }
  return (
    <FormDialog open title="Edit goal" onClose={onClose} onSubmit={submit} pending={pending} error={error} maxWidth="xs">
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus disabled={pending} />
      <AssigneeSelect value={assigneeId} onChange={setAssigneeId} assignees={assignees} disabled={pending} />
    </FormDialog>
  )
}
GoalEditDialog.propTypes = {
  goal: PropTypes.object.isRequired,
  assignees: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
}

/**
 * Checklist for one milestone. `canManage` → add/rename/assign/delete; `canTick(goal)` → checkbox enabled.
 * Toggles are optimistic: the checkbox flips at once and reverts if the API refuses.
 */
export default function GoalList({ milestone, canManage, canTick, onChanged, notify }) {
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [pending, setPending] = useState(false)
  const [optimistic, setOptimistic] = useState({})

  async function toggle(goal) {
    const next = !(optimistic[goal.id] ?? goal.isDone)
    setOptimistic((o) => ({ ...o, [goal.id]: next }))
    try {
      await milestonesApi.updateGoal(goal.id, { isDone: next })
      onChanged()
    } catch (err) {
      setOptimistic((o) => ({ ...o, [goal.id]: goal.isDone }))
      notify(err.message, 'error')
    }
  }

  async function addGoal(event) {
    event.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    try {
      await milestonesApi.createGoal(milestone.id, { title: title.trim(), assigneeId: assigneeId || null })
      setTitle('')
      setAssigneeId(UNASSIGNED)
      onChanged()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  async function confirmDelete() {
    setPending(true)
    try {
      await milestonesApi.deleteGoal(deleting.id)
      notify(`Deleted goal '${deleting.title}'`)
      setDeleting(null)
      onChanged()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setPending(false)
    }
  }

  const goals = milestone.goals
  const done = goals.filter((g) => optimistic[g.id] ?? g.isDone).length

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
        <Typography variant="h6" component="h2">
          Goals
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {goals.length === 0 ? 'None yet' : `${done} of ${goals.length} done`}
        </Typography>
      </Stack>
      {goals.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          {canManage ? 'Add the first goal below.' : 'No goals have been added to this milestone yet.'}
        </Typography>
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {goals.map((goal) => {
          const isDone = optimistic[goal.id] ?? goal.isDone
          const tickable = canTick(goal)
          return (
            <Box
              component="li"
              key={goal.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                borderTop: '1px solid',
                borderColor: 'divider',
                '&:first-of-type': { borderTop: 0 },
              }}
            >
              <Checkbox
                checked={isDone}
                disabled={!tickable}
                onChange={() => toggle(goal)}
                size="small"
                slotProps={{ input: { 'aria-label': `${isDone ? 'Reopen' : 'Complete'} goal ${goal.title}` } }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'text.secondary' : 'text.primary' }}>
                  {goal.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {goal.assignee ? fullName(goal.assignee) : 'Unassigned'}
                </Typography>
              </Box>
              {canManage && (
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Edit goal">
                    <IconButton size="small" aria-label={`Edit goal ${goal.title}`} onClick={() => setEditing(goal)} sx={{ color: 'text.secondary' }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete goal">
                    <IconButton
                      size="small"
                      aria-label={`Delete goal ${goal.title}`}
                      onClick={() => setDeleting(goal)}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Box>
          )
        })}
      </Box>
      {canManage && (
        <Stack
          component="form"
          onSubmit={addGoal}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', alignItems: { sm: 'flex-start' } }}
        >
          <TextField label="New goal" value={title} onChange={(e) => setTitle(e.target.value)} disabled={adding} sx={{ flexGrow: 1 }} />
          <AssigneeSelect value={assigneeId} onChange={setAssigneeId} assignees={milestone.assignees} disabled={adding} />
          <Button type="submit" variant="outlined" startIcon={<AddIcon />} disabled={adding || !title.trim()} sx={{ flexShrink: 0, minHeight: 40 }}>
            Add goal
          </Button>
        </Stack>
      )}
      {editing && (
        <GoalEditDialog
          goal={editing}
          assignees={milestone.assignees}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            notify('Goal updated')
            onChanged()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete goal?"
        message={deleting ? `'${deleting.title}' will be removed from this milestone.` : ''}
        confirmLabel="Delete"
        confirmColor="error"
        pending={pending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </Paper>
  )
}

GoalList.propTypes = {
  milestone: PropTypes.object.isRequired,
  canManage: PropTypes.bool.isRequired,
  canTick: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
}
