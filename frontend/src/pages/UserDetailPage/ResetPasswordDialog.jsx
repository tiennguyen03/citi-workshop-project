import { useState } from 'react'
import PropTypes from 'prop-types'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormDialog from '../../components/FormDialog/FormDialog.jsx'
import * as usersApi from '../../services/users.js'
import { validateTemporaryPassword } from '../../utils/passwordForm.js'
import { fullName } from '../../utils/roles.js'

/** Admin sets a new temporary password for someone who forgot theirs. */
export default function ResetPasswordDialog({ open, user, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    const problem = validateTemporaryPassword(password)
    if (problem) {
      setFieldError(problem)
      return
    }
    setPending(true)
    setError(null)
    try {
      await usersApi.update(user.id, { password })
      setPassword('')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog open={open} title="Set a temporary password" onClose={onClose} onSubmit={submit} submitLabel="Set password" pending={pending} error={error} maxWidth="xs">
      <Typography variant="body2" color="text.secondary">
        {fullName(user)} will sign in with this password and can change it from their profile.
      </Typography>
      <TextField
        label="Temporary password"
        type="text"
        autoComplete="off"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          setFieldError(null)
        }}
        error={Boolean(fieldError)}
        helperText={fieldError ?? 'At least 8 characters. Share it with them directly.'}
        disabled={pending}
        required
        autoFocus
      />
    </FormDialog>
  )
}

ResetPasswordDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  user: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
}
