import { api } from './client.js'

/** GET /projects/{id}/milestones → { items, total } */
export function list(projectId) {
  return api.get(`/projects/${projectId}/milestones`)
}

/** POST /projects/{id}/milestones → Milestone */
export function create(projectId, body) {
  return api.post(`/projects/${projectId}/milestones`, body)
}

/** GET /projects/{id}/available-assignees?milestoneId= → { items, busy, total } */
export function availableAssignees(projectId, milestoneId) {
  return api.get(`/projects/${projectId}/available-assignees`, { query: { milestoneId } })
}

/** GET /milestones/{id} → Milestone (with goals) */
export function get(id) {
  return api.get(`/milestones/${id}`)
}

/** PATCH /milestones/{id} → Milestone */
export function update(id, body) {
  return api.patch(`/milestones/${id}`, body)
}

/** POST /milestones/{id}/complete → Milestone (+ details.openGoals) */
export function complete(id) {
  return api.post(`/milestones/${id}/complete`)
}

export function reopen(id) {
  return api.post(`/milestones/${id}/reopen`)
}

/** POST /milestones/{id}/goals → Goal */
export function createGoal(milestoneId, body) {
  return api.post(`/milestones/${milestoneId}/goals`, body)
}

/** PATCH /goals/{id} → Goal */
export function updateGoal(goalId, body) {
  return api.patch(`/goals/${goalId}`, body)
}

export function deleteGoal(goalId) {
  return api.delete(`/goals/${goalId}`)
}
