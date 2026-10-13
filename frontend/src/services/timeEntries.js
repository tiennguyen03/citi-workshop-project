import { api } from './client.js'

/** GET /projects/{id}/time-entries?userId=&from=&to= → { items, total } */
export function list(projectId, query) {
  return api.get(`/projects/${projectId}/time-entries`, { query })
}

/** POST /projects/{id}/time-entries → TimeEntry */
export function create(projectId, body) {
  return api.post(`/projects/${projectId}/time-entries`, body)
}

/** PATCH /time-entries/{id} → TimeEntry */
export function update(id, body) {
  return api.patch(`/time-entries/${id}`, body)
}

export function remove(id) {
  return api.delete(`/time-entries/${id}`)
}
