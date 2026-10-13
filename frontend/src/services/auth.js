import { api } from './client.js'

/** POST /auth/login → { token, expiresAt, user } */
export function login(username, password) {
  return api.post('/auth/login', { username, password })
}

/** GET /auth/me → UserFull (self) */
export function me() {
  return api.get('/auth/me')
}
