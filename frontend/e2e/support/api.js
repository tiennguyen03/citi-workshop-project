/** Thin API client for test setup: creates the people and projects a spec needs, through the real backend. */

export const API = 'http://localhost:3001/api/v1'
export const PASSWORD = 'Password1!'
export const ADMIN = { username: 'admin', password: 'Admin123!' }

let counter = 0
/** Unique, username-safe suffix per run (usernames are [a-z0-9._-], 3–32 chars). */
export function unique(prefix) {
  counter += 1
  return `${prefix}.${Date.now().toString(36)}${counter}`.toLowerCase()
}

export async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = res.status === 204 ? null : await res.json()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`)
  return data
}

export async function token(username, password = PASSWORD) {
  return (await api('POST', '/auth/login', { username, password })).token
}

export async function createUser(adminToken, { role, managerId, salary = 104000, firstName, lastName, jobTitle }) {
  const username = unique(role === 'manager' ? 'mgr' : 'emp')
  const user = await api(
    'POST',
    '/users',
    {
      username,
      password: PASSWORD,
      firstName,
      lastName,
      email: `${username}@example.com`,
      jobTitle,
      salary,
      role,
      ...(managerId ? { managerId } : {}),
    },
    adminToken,
  )
  return { ...user, username, token: await token(username) }
}

/**
 * A small office of its own: one manager with two direct reports. Nothing here touches the seeded
 * demo people, so specs can mutate freely and be rerun.
 */
export async function makeOffice(tag) {
  const admin = await token(ADMIN.username, ADMIN.password)
  tag = `${tag}-${Date.now().toString(36).slice(-4)}` // display names must be unique too: tests pick people by name
  const manager = await createUser(admin, { role: 'manager', firstName: 'Morgan', lastName: `Lead-${tag}`, jobTitle: 'Delivery Manager' })
  const emp1 = await createUser(admin, { role: 'employee', managerId: manager.id, firstName: 'Avery', lastName: `Reed-${tag}`, jobTitle: 'Engineer' })
  const emp2 = await createUser(admin, { role: 'employee', managerId: manager.id, firstName: 'Blake', lastName: `Ortiz-${tag}`, jobTitle: 'Analyst' })
  return { admin, manager, emp1, emp2 }
}

export const PROJECT_DATES = { startDate: '2026-10-05', endDate: '2026-12-18' }

export async function createProject(adminToken, managerId, overrides = {}) {
  return api(
    'POST',
    '/projects',
    { name: `E2E ${unique('prj')}`, description: 'Created by the browser suite', budget: 100000, ...PROJECT_DATES, managerId, ...overrides },
    adminToken,
  )
}

export async function addMember(managerToken, projectId, userId, hoursAssigned = 200) {
  return api('POST', `/projects/${projectId}/members`, { userId, hoursAssigned }, managerToken)
}

export async function createMilestone(managerToken, projectId, overrides = {}) {
  return api(
    'POST',
    `/projects/${projectId}/milestones`,
    { name: 'Phase 1', description: 'First phase', startDate: '2026-10-05', dueDate: '2026-10-30', assigneeIds: [], ...overrides },
    managerToken,
  )
}

export const fullName = (u) => `${u.firstName} ${u.lastName}`
