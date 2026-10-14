import { todayISO } from './dates.js'

export { todayISO }

/** Client-side checks mirroring the API contract for time entries. Returns {field: message}. */
export function validateTimeEntry(values, project, today = todayISO()) {
  const errors = {}
  const projectStart = String(project.startDate).slice(0, 10)
  const projectEnd = String(project.endDate).slice(0, 10)
  if (!values.entryDate) errors.entryDate = 'Required'
  else if (values.entryDate > today) errors.entryDate = 'Cannot be in the future'
  else if (values.entryDate < projectStart || values.entryDate > projectEnd) {
    errors.entryDate = `Must be within the project dates (${projectStart} – ${projectEnd})`
  }
  const hours = Number(values.hours)
  if (values.hours === '' || Number.isNaN(hours)) errors.hours = 'Required'
  else if (hours < 0.25 || hours > 24) errors.hours = 'Between 0.25 and 24'
  else if (Math.round(hours * 4) !== hours * 4) errors.hours = 'Use quarter hours (0.25, 0.5, 0.75…)'
  if (values.note && values.note.length > 500) errors.note = 'At most 500 characters'
  return errors
}

/** Sum of entry hours for a "this week" style total. */
export function sumHours(entries) {
  return entries.reduce((total, e) => total + Number(e.hours), 0)
}
