export const MIN_PASSWORD_LENGTH = 8

/** Client-side checks for the change-password form. Returns {field: message}. */
export function validatePasswordChange(values) {
  const errors = {}
  if (!values.currentPassword) errors.currentPassword = 'Required'
  if (values.newPassword.length < MIN_PASSWORD_LENGTH) errors.newPassword = `At least ${MIN_PASSWORD_LENGTH} characters`
  else if (values.newPassword === values.currentPassword) errors.newPassword = 'Choose a different password'
  if (values.confirmPassword !== values.newPassword) errors.confirmPassword = 'Passwords do not match'
  return errors
}

/** Client-side check for an admin-set temporary password. */
export function validateTemporaryPassword(password) {
  return password.length < MIN_PASSWORD_LENGTH ? `At least ${MIN_PASSWORD_LENGTH} characters` : null
}
