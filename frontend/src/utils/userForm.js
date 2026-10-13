import { ROLES } from './roles.js'

/** Form values for a user object (strings for inputs, booleans for switches). */
export function toUserFormValues(user) {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    email: user.email ?? '',
    jobTitle: user.jobTitle ?? '',
    salary: user.salary ?? '',
    role: user.role ?? ROLES.EMPLOYEE,
    managerId: user.managerId ?? '',
    isActive: user.isActive ?? true,
  }
}

/** Returns only the fields whose value differs from the loaded user, in API shape. */
export function changedFields(user, values, editable) {
  const original = toUserFormValues(user)
  const out = {}
  editable.forEach((field) => {
    let next = values[field]
    if (field === 'salary') next = next === '' ? null : Number(next)
    if (field === 'managerId') next = next === '' ? null : next
    const prev = field === 'salary' ? (original.salary === '' ? null : Number(original.salary)) : original[field]
    if (field === 'managerId' && original.managerId === '' && next === null) return
    if (next !== prev) out[field] = next
  })
  return out
}
