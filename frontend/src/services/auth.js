import { api } from './client.js'

/** POST /auth/login → { token, expiresAt, user } */
export function login(username, password) {
  return api.post('/auth/login', { username, password })
}

/** POST /auth/change-password → { changed: true } (self) */
export function changePassword(body) {
  return api.post('/auth/change-password', body)
}

/** GET /auth/me → UserFull (self) */
export function me() {
  return api.get('/auth/me')
}
