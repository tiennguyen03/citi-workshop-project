import { api } from './client.js'

/** GET /dashboard → role-shaped payload (api-contract.md › Dashboard) */
export function get() {
  return api.get('/dashboard')
}
