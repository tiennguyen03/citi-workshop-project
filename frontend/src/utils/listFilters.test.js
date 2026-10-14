import { describe, expect, it } from 'vitest'
import { filterProjects, filterUsers } from './listFilters.js'

const PROJECTS = [
  { id: 'A', name: 'Decommission 1,000 Servers', status: 'active', manager: { firstName: 'Priya', lastName: 'Natarajan' } },
  { id: 'B', name: 'Customer Portal', status: 'active', manager: { firstName: 'Marcus', lastName: 'Bell' } },
  { id: 'C', name: 'Legacy VPN', status: 'complete', manager: { firstName: 'Priya', lastName: 'Natarajan' } },
]
const USERS = [
  { id: '1', firstName: 'John', lastName: 'Doe', username: 'john.doe', email: 'john@x.com', role: 'employee', isActive: true, currentProject: { id: 'A' } },
  { id: '2', firstName: 'Grace', lastName: "O'Connor", username: 'grace.oconnor', email: 'grace@x.com', role: 'employee', isActive: true, currentProject: null },
  { id: '3', firstName: 'Priya', lastName: 'Natarajan', username: 'priya', email: 'priya@x.com', role: 'manager', isActive: true },
  { id: '4', firstName: 'Old', lastName: 'Timer', username: 'old.timer', email: 'old@x.com', role: 'employee', isActive: false, currentProject: null },
]
const ids = (rows) => rows.map((r) => r.id)

describe('filterProjects', () => {
  it('returns everything with no filters', () => expect(ids(filterProjects(PROJECTS))).toEqual(['A', 'B', 'C']))
  it('searches name and manager, ignoring case', () => {
    expect(ids(filterProjects(PROJECTS, { q: 'portal' }))).toEqual(['B'])
    expect(ids(filterProjects(PROJECTS, { q: 'PRIYA' }))).toEqual(['A', 'C'])
  })
  it('combines status with search', () => expect(ids(filterProjects(PROJECTS, { q: 'priya', status: 'complete' }))).toEqual(['C']))
})

describe('filterUsers', () => {
  it('hides deactivated accounts by default and shows them on request', () => {
    expect(ids(filterUsers(USERS))).toEqual(['1', '2', '3'])
    expect(ids(filterUsers(USERS, { inactive: 'true' }))).toEqual(['1', '2', '3', '4'])
  })
  it('filters by role and availability', () => {
    expect(ids(filterUsers(USERS, { role: 'manager' }))).toEqual(['3'])
    expect(ids(filterUsers(USERS, { available: 'true' }))).toEqual(['2'])
  })
  it('searches name, email and username', () => {
    expect(ids(filterUsers(USERS, { q: "o'connor" }))).toEqual(['2'])
    expect(ids(filterUsers(USERS, { q: 'john@' }))).toEqual(['1'])
    expect(ids(filterUsers(USERS, { q: 'priya' }))).toEqual(['3'])
  })
})
