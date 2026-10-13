import { useState } from 'react'
import PropTypes from 'prop-types'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import useFormState from '../../hooks/useFormState.js'
import * as usersApi from '../../services/users.js'
import { ROLES, ROLE_LABELS, fullName } from '../../utils/roles.js'

const INITIAL = {
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  email: '',
  jobTitle: '',
  salary: '',
  role: ROLES.EMPLOYEE,
  managerId: '',
}

function validate(values) {
  const errors = {}
  if (!/^[a-z0-9._-]{3,32}$/.test(values.username.trim().toLowerCase())) {
    errors.username = '3–32 characters: letters, digits, . _ -'
  }
  if (values.password.length < 8) errors.password = 'At least 8 characters'
  if (!values.firstName.trim()) errors.firstName = 'Required'
  if (!values.lastName.trim()) errors.lastName = 'Required'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) errors.email = 'Enter a valid email'
  if (!values.jobTitle.trim()) errors.jobTitle = 'Required'
  if (values.salary === '' || Number(values.salary) < 0) errors.salary = 'Enter a salary of 0 or more'
  if (values.role === ROLES.EMPLOYEE && !values.managerId) errors.managerId = 'Employees need a manager'
  return errors
}

/** Admin "New user" dialog (ui-flow.md F2). */
export default function UserCreateDialog({ open, managers, onClose, onCreated }) {
  const { values, errors, setField, setErrors, reset, applyServerError } = useFormState(INITIAL)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  async function submit() {
    const clientErrors = validate(values)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      const body = {
        username: values.username.trim().toLowerCase(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        jobTitle: values.jobTitle.trim(),
        salary: Number(values.salary),
        role: values.role,
        ...(values.role === ROLES.EMPLOYEE ? { managerId: values.managerId } : {}),
      }
      const user = await usersApi.create(body)
      reset()
      onCreated(user)
    } catch (err) {
      setFormError(applyServerError(err))
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
      required
      {...extra}
    />
  )

  return (
    <FormDialog open={open} title="New user" onClose={close} onSubmit={submit} submitLabel="Create user" pending={pending} error={formError}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('firstName', 'First name')}
        {field('lastName', 'Last name')}
      </Stack>
      {field('email', 'Email', { type: 'email' })}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('username', 'Username', { autoComplete: 'off' })}
        {field('password', 'Temporary password', { type: 'password', autoComplete: 'new-password' })}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('jobTitle', 'Job title')}
        {field('salary', 'Annual salary', { type: 'number', slotProps: { htmlInput: { min: 0, step: 1 } } })}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('role', 'Role', {
          select: true,
          children: Object.values(ROLES).map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </MenuItem>
          )),
        })}
        {values.role === ROLES.EMPLOYEE &&
          field('managerId', 'Manager', {
            select: true,
            children:
              managers.length > 0
                ? managers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {fullName(m)}
                    </MenuItem>
                  ))
                : [
                    <MenuItem key="none" value="" disabled>
                      No managers yet — create a manager first
                    </MenuItem>,
                  ],
          })}
      </Stack>
    </FormDialog>
  )
}

UserCreateDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  managers: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
}
