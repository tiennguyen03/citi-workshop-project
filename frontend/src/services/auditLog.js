import { api } from './client.js'

/** GET /audit-log?actorId=&entityType=&entityId=&projectId=&action=&from=&to=&limit=&offset= */
export function list(query) {
  return api.get('/audit-log', { query })
}
