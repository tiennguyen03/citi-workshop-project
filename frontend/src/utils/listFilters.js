import { ROLES, fullName } from './roles.js'

const norm = (value) => String(value ?? '').toLowerCase()
const matches = (needle, ...haystack) => !needle || haystack.some((h) => norm(h).includes(needle))

/** Client-side narrowing of the projects list: `q` on name/manager, `status` exact. */
export function filterProjects(items, { q = '', status = '' } = {}) {
  const needle = norm(q).trim()
  return items.filter((p) => (!status || p.status === status) && matches(needle, p.name, p.manager && fullName(p.manager)))
}

/**
 * Client-side narrowing of the users list. Deactivated accounts are hidden unless
 * `inactive === 'true'`; `available === 'true'` keeps only employees with no current project.
 */
export function filterUsers(items, { q = '', role = '', available = '', inactive = '' } = {}) {
  const needle = norm(q).trim()
  return items.filter(
    (u) =>
      (inactive === 'true' || u.isActive !== false) &&
      (!role || u.role === role) &&
      (available !== 'true' || (u.role === ROLES.EMPLOYEE && !u.currentProject)) &&
      matches(needle, fullName(u), u.email, u.username),
  )
}
