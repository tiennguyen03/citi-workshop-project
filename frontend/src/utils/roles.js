/** Role constants mirroring the backend (context/security.md). */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
})

export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
})

/** Display name for a user object. */
export function fullName(user) {
  if (!user) return ''
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
}
