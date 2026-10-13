import { api } from './client.js'

/** GET /projects?archived=&status= → { items, total } */
export function list(query) {
  return api.get('/projects', { query })
}

/** POST /projects → ProjectDetail (admin) */
export function create(body) {
  return api.post('/projects', body)
}

/** GET /projects/{id} → ProjectDetail */
export function get(id) {
  return api.get(`/projects/${id}`)
}

/** PATCH /projects/{id} → ProjectDetail */
export function update(id, body) {
  return api.patch(`/projects/${id}`, body)
}

export function complete(id) {
  return api.post(`/projects/${id}/complete`)
}

export function archive(id) {
  return api.post(`/projects/${id}/archive`)
}

export function unarchive(id) {
  return api.post(`/projects/${id}/unarchive`)
}

/** GET /projects/{id}/stats → ProjectStats */
export function stats(id) {
  return api.get(`/projects/${id}/stats`)
}

/** GET /projects/{id}/members?includeReleased= → { items, total } */
export function members(id, includeReleased = false) {
  return api.get(`/projects/${id}/members`, { query: { includeReleased: includeReleased ? 'true' : undefined } })
}

/** GET /projects/{id}/available-members → { items, total } */
export function availableMembers(id) {
  return api.get(`/projects/${id}/available-members`)
}

export function addMember(id, body) {
  return api.post(`/projects/${id}/members`, body)
}

export function updateMember(id, userId, body) {
  return api.patch(`/projects/${id}/members/${userId}`, body)
}

export function removeMember(id, userId) {
  return api.delete(`/projects/${id}/members/${userId}`)
}
