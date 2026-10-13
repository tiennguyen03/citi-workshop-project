import { useState } from 'react'
import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import useFormState from '../../hooks/useFormState.js'
import * as timeEntriesApi from '../../services/timeEntries.js'
import { todayISO, validateTimeEntry } from '../../utils/timeEntryForm.js'

/** Log or edit one time entry (ui-flow.md F6). `entry` null → create on `project`. */
export default function TimeEntryDialog({ open, project, entry = null, onClose, onSaved }) {
  const initial = entry
    ? { entryDate: String(entry.entryDate).slice(0, 10), hours: String(entry.hours), note: entry.note ?? '' }
    : { entryDate: todayISO(), hours: '', note: '' }
  const { values, errors, setField, setErrors, applyServerError } = useFormState(initial)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)
  const projectStart = String(project.startDate).slice(0, 10)
  const projectEnd = String(project.endDate).slice(0, 10)

  async function submit() {
    const clientErrors = validateTimeEntry(values, project)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      const body = { entryDate: values.entryDate, hours: Number(values.hours), note: values.note.trim() }
      const saved = entry ? await timeEntriesApi.update(entry.id, body) : await timeEntriesApi.create(project.id, body)
      onSaved(saved)
    } catch (err) {
      setFormError(applyServerError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog
      open={open}
      title={entry ? 'Edit time entry' : 'Log time'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={entry ? 'Save' : 'Log time'}
      pending={pending}
      error={formError}
      maxWidth="xs"
    >
      <Stack direction="row" spacing={2}>
        <TextField
          label="Date"
          name="entryDate"
          type="date"
          value={values.entryDate}
          onChange={(e) => setField('entryDate', e.target.value)}
          error={Boolean(errors.entryDate)}
          helperText={errors.entryDate}
          disabled={pending}
          required
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: projectStart, max: todayISO() < projectEnd ? todayISO() : projectEnd } }}
        />
        <TextField
          label="Hours"
          name="hours"
          type="number"
          value={values.hours}
          onChange={(e) => setField('hours', e.target.value)}
          error={Boolean(errors.hours)}
          helperText={errors.hours ?? 'In quarter hours, up to 24'}
          disabled={pending}
          required
          autoFocus
          slotProps={{ htmlInput: { min: 0.25, max: 24, step: 0.25 } }}
        />
      </Stack>
      <TextField
        label="Note"
        name="note"
        value={values.note}
        onChange={(e) => setField('note', e.target.value)}
        error={Boolean(errors.note)}
        helperText={errors.note}
        disabled={pending}
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </FormDialog>
  )
}

TimeEntryDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  project: PropTypes.object.isRequired,
  entry: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
}
