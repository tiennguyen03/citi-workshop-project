import { useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import useFormState from '../../hooks/useFormState.js'
import { ROLES, ROLE_LABELS, fullName } from '../../utils/roles.js'
import { changedFields, toUserFormValues } from '../../utils/userForm.js'

const NAME_EMAIL = ['firstName', 'lastName', 'email']
const ADMIN_ONLY = ['jobTitle', 'salary', 'role', 'managerId', 'isActive']

/**
 * Edit a user's details. Which fields are editable depends on the viewer:
 * admin → everything; manager (for reports) and the user themself → name + email only.
 * Presentational: the page passes the data in and performs the save.
 */
export default function UserEditForm({
  user,
  canEditNameEmail = false,
  isAdmin = false,
  managers = [],
  onSave,
  saveLabel = 'Save changes',
}) {
  const { values, errors, setField, applyServerError } = useFormState(toUserFormValues(user))
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)

  const editable = [...(canEditNameEmail ? NAME_EMAIL : []), ...(isAdmin ? ADMIN_ONLY : [])]
  if (editable.length === 0) return null

  const isEmployee = values.role === ROLES.EMPLOYEE
  const changes = changedFields(user, values, editable)
  const dirty = Object.keys(changes).length > 0

  async function handleSubmit(event) {
    event.preventDefault()
    if (!dirty || pending) return
    setPending(true)
    setFormError(null)
    try {
      await onSave(changes)
    } catch (err) {
      setFormError(applyServerError(err))
    } finally {
      setPending(false)
    }
  }

  const field = (name, label, extra = {}) => (
    <TextField
      key={name}
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
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        {canEditNameEmail && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {field('firstName', 'First name', { required: true })}
            {field('lastName', 'Last name', { required: true })}
          </Stack>
        )}
        {canEditNameEmail && field('email', 'Email', { type: 'email', required: true })}
        {isAdmin && (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {field('jobTitle', 'Job title', { required: true })}
              {field('salary', 'Annual salary', {
                type: 'number',
                required: true,
                slotProps: { htmlInput: { min: 0, step: 1 } },
              })}
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
              {isEmployee &&
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
            <FormControlLabel
              control={
                <Switch
                  checked={values.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                  disabled={pending}
                />
              }
              label={values.isActive ? 'Active — can sign in' : 'Deactivated — cannot sign in'}
            />
          </>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={!dirty || pending}>
            {pending ? 'Saving…' : saveLabel}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

UserEditForm.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    jobTitle: PropTypes.string,
    salary: PropTypes.number,
    role: PropTypes.string,
    managerId: PropTypes.string,
    isActive: PropTypes.bool,
  }).isRequired,
  canEditNameEmail: PropTypes.bool,
  isAdmin: PropTypes.bool,
  managers: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, firstName: PropTypes.string, lastName: PropTypes.string })),
  onSave: PropTypes.func.isRequired,
  saveLabel: PropTypes.node,
}
