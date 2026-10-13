import { api } from './client.js'

/** GET /health → { status, db } */
export function getHealth() {
  return api.get('/health')
}
