import { api } from './client.js'

/** GET /users?role=&managerId= → { items, total } */
export function list(query) {
  return api.get('/users', { query })
}

/** POST /users → UserFull */
export function create(body) {
  return api.post('/users', body)
}

/** GET /users/{id} → UserFull | UserSummary */
export function get(id) {
  return api.get(`/users/${id}`)
}

/** PATCH /users/{id} → UserFull */
export function update(id, body) {
  return api.patch(`/users/${id}`, body)
}

/** GET /users/{id}/team → { manager, members } */
export function team(id) {
  return api.get(`/users/${id}/team`)
}

/** POST /users/import { csv, dryRun } → { rows: [{ line, username, status, errors, generatedPassword?, id? }], summary } */
export function importCsv(csv, { dryRun = false } = {}) {
  return api.post('/users/import', { csv, dryRun })
}
