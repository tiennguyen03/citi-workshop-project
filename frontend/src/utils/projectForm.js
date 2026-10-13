/** Client-side checks mirroring the API contract for project create/edit. Returns {field: message}. */
export function validateProject(values, { requireManager }) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Required'
  if (values.budget === '' || Number(values.budget) < 0) errors.budget = 'Enter a budget of 0 or more'
  if (!values.startDate) errors.startDate = 'Required'
  if (!values.endDate) errors.endDate = 'Required'
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'Must be on or after the start date'
  }
  if (requireManager && !values.managerId) errors.managerId = 'Choose a manager'
  return errors
}
