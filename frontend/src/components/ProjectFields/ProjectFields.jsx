import PropTypes from 'prop-types'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { fullName } from '../../utils/roles.js'

/** Shared project form fields for create (page) and edit (dialog). Validation: utils/projectForm.js. */
export default function ProjectFields({ values, errors, setField, pending, managers, showManager }) {
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
  return (
    <>
      {field('name', 'Project name', { required: true, autoFocus: true })}
      {field('description', 'Description', { multiline: true, minRows: 2 })}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('budget', 'Budget (USD)', { type: 'number', required: true, slotProps: { htmlInput: { min: 0, step: 100 } } })}
        {showManager &&
          field('managerId', 'Manager', {
            select: true,
            required: true,
            children: managers.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {fullName(m)}
              </MenuItem>
            )),
          })}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('startDate', 'Start date', { type: 'date', required: true, slotProps: { inputLabel: { shrink: true } } })}
        {field('endDate', 'End date', { type: 'date', required: true, slotProps: { inputLabel: { shrink: true } } })}
      </Stack>
    </>
  )
}

ProjectFields.propTypes = {
  values: PropTypes.object.isRequired,
  errors: PropTypes.object.isRequired,
  setField: PropTypes.func.isRequired,
  pending: PropTypes.bool,
  managers: PropTypes.arrayOf(PropTypes.object),
  showManager: PropTypes.bool,
}
