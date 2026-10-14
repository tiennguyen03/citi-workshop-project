import { useCallback, useState } from 'react'

/**
 * Minimal controlled-form state: values, per-field errors, and a server-error mapper.
 * Not a form library — pages still own validation and submission (coding-rules.md).
 */
export default function useFormState(initialValues) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  const setField = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }, [])

  const reset = useCallback((next) => {
    setValues(next ?? initialValues)
    setErrors({})
  }, [initialValues])

  /** Map an ApiError (400 with details.field, or 409) onto a field, or return the message. */
  const applyServerError = useCallback((error) => {
    const field = error?.details?.field
    if (field) {
      setErrors((prev) => ({ ...prev, [field]: error.message.replace(/^\w+: /, '') }))
      return null
    }
    return error?.message || 'The server did not answer. Check the connection and try again.'
  }, [])

  return { values, errors, setField, setErrors, reset, applyServerError }
}
