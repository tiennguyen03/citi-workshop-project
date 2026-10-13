/**
 * The only place the frontend talks HTTP. Adds the base URL and Bearer token, parses the
 * JSON error envelope into ApiError, and notifies the auth layer on 401.
 */

const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api/v1`
const LOGIN_PATH = '/auth/login'

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details || {}
  }
}

let authToken = null
let unauthorizedHandler = null

/** Set (or clear with null) the token attached to every request. */
export function setAuthToken(token) {
  authToken = token
}

/** Called whenever a protected request comes back 401 (session expired/revoked). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

function buildUrl(path, query) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  return url.toString()
}

/**
 * Perform a request. Resolves with the parsed JSON body (null for 204); rejects with ApiError.
 * @param {string} method
 * @param {string} path  e.g. "/projects/ABC123"
 * @param {{ body?: object, query?: object }} [options]
 */
export async function request(method, path, { body, query } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server', { cause: cause.message })
  }

  if (response.status === 204) return null

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const error = data?.error || {}
    if (response.status === 401 && path !== LOGIN_PATH && unauthorizedHandler) unauthorizedHandler()
    throw new ApiError(
      response.status,
      error.code || 'HTTP_ERROR',
      error.message || `Request failed (${response.status})`,
      error.details,
    )
  }
  return data
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
}
