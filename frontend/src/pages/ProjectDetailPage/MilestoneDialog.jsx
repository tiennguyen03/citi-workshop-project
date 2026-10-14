import { useState } from 'react'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import useApi from '../../hooks/useApi.js'
import useFormState from '../../hooks/useFormState.js'
import * as milestonesApi from '../../services/milestones.js'
import { conflictMessage, defaultMilestoneStart, milestoneChanges, toMilestoneValues, validateMilestone } from '../../utils/milestoneForm.js'
import { fullName } from '../../utils/roles.js'

const EMPTY = { name: '', description: '', startDate: '', dueDate: '', assigneeIds: [] }

/**
 * Create or edit a milestone (ui-flow.md F5). Assignees come from `available-assignees`:
 * free members are selectable, busy ones are listed disabled with the milestone holding them.
 */
export default function MilestoneDialog({ open, project, milestone = null, onClose, onSaved }) {
  const initial = milestone ? toMilestoneValues(milestone) : { ...EMPTY, startDate: defaultMilestoneStart(project) }
  const { values, errors, setField, setErrors, applyServerError } = useFormState(initial)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)
  const { data: people } = useApi(
    () => (open ? milestonesApi.availableAssignees(project.id, milestone?.id) : Promise.resolve(null)),
    [open, project.id, milestone?.id],
  )
  const free = people?.items ?? []
  const busy = people?.busy ?? []
  const everyone = [...free, ...busy.map((b) => b.user)]

  async function submit() {
    const clientErrors = validateMilestone(values, project)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      let saved
      if (milestone) {
        const changes = milestoneChanges(toMilestoneValues(milestone), values)
        if (Object.keys(changes).length === 0) {
          onClose()
          return
        }
        saved = await milestonesApi.update(milestone.id, changes)
      } else {
        saved = await milestonesApi.create(project.id, {
          name: values.name.trim(),
          description: values.description.trim(),
          startDate: values.startDate,
          dueDate: values.dueDate,
          assigneeIds: values.assigneeIds,
        })
      }
      onSaved(saved)
    } catch (err) {
      if (err.code === 'MILESTONE_CONFLICT') setErrors({ assigneeIds: conflictMessage(err, everyone) })
      else setFormError(applyServerError(err))
    } finally {
      setPending(false)
    }
  }

  const field = (name, label, extra = {}) => (
    <TextField
      name={name}
      label={label}
      value={values[name]}
      onChange={(e) => setField(name, e.target.value)}
      error={Boolean(errors[name])}
      helperText={errors[name]}
      disabled={pending}
      {...extra}
    />
  )
  const projectStart = String(project.startDate).slice(0, 10)
  const projectEnd = String(project.endDate).slice(0, 10)

  return (
    <FormDialog
      open={open}
      title={milestone ? 'Edit milestone' : 'New milestone'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={milestone ? 'Save' : 'Create milestone'}
      pending={pending}
      error={formError}
    >
      {field('name', 'Name', { required: true, autoFocus: true })}
      {field('description', 'Description', { multiline: true, minRows: 2 })}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('startDate', 'Start date', {
          type: 'date',
          required: true,
          slotProps: { inputLabel: { shrink: true }, htmlInput: { min: projectStart, max: projectEnd } },
        })}
        {field('dueDate', 'Due date', {
          type: 'date',
          required: true,
          slotProps: { inputLabel: { shrink: true }, htmlInput: { min: projectStart, max: projectEnd } },
        })}
      </Stack>
      <TextField
        select
        name="assigneeIds"
        label="Assignees"
        value={values.assigneeIds}
        onChange={(e) => setField('assigneeIds', e.target.value)}
        error={Boolean(errors.assigneeIds)}
        helperText={errors.assigneeIds ?? 'Each person can be on one open milestone at a time.'}
        disabled={pending}
        slotProps={{
          select: {
            multiple: true,
            renderValue: (ids) => everyone.filter((p) => ids.includes(p.id)).map(fullName).join(', ') || '',
          },
        }}
      >
        {free.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            <Checkbox size="small" checked={values.assigneeIds.includes(p.id)} sx={{ p: 0.5, mr: 1 }} />
            <ListItemText primary={fullName(p)} secondary={p.jobTitle} />
          </MenuItem>
        ))}
        {busy.map((b) => (
          <MenuItem key={b.user.id} value={b.user.id} disabled>
            <Checkbox size="small" checked={false} sx={{ p: 0.5, mr: 1 }} />
            <ListItemText primary={fullName(b.user)} secondary={`on ${b.milestone.name}`} />
          </MenuItem>
        ))}
        {free.length === 0 && busy.length === 0 && (
          <MenuItem disabled value="">
            <Typography variant="body2" color="text.secondary">
              No members on this project yet
            </Typography>
          </MenuItem>
        )}
      </TextField>
    </FormDialog>
  )
}

MilestoneDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  project: PropTypes.object.isRequired,
  milestone: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
}
