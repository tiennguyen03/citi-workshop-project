import { useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import useFormState from '../../hooks/useFormState.js'
import * as authApi from '../../services/auth.js'
import { validatePasswordChange } from '../../utils/passwordForm.js'

const INITIAL = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** Self-service password change (profile page). The API checks the current password. */
export default function PasswordForm({ onChanged }) {
  const { values, errors, setField, setErrors, reset, applyServerError } = useFormState(INITIAL)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const clientErrors = validatePasswordChange(values)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      reset()
      onChanged()
    } catch (err) {
      setFormError(applyServerError(err))
    } finally {
      setPending(false)
    }
  }

  const field = (name, label, autoComplete) => (
    <TextField
      name={name}
      label={label}
      type="password"
      autoComplete={autoComplete}
      value={values[name]}
      onChange={(e) => setField(name, e.target.value)}
      error={Boolean(errors[name])}
      helperText={errors[name]}
      disabled={pending}
      required
    />
  )
  const filled = values.currentPassword && values.newPassword && values.confirmPassword

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        {field('currentPassword', 'Current password', 'current-password')}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {field('newPassword', 'New password', 'new-password')}
          {field('confirmPassword', 'Confirm new password', 'new-password')}
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={!filled || pending}>
            {pending ? 'Changing…' : 'Change password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

PasswordForm.propTypes = {
  onChanged: PropTypes.func.isRequired,
}
