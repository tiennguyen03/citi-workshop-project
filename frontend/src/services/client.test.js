import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from './client.js'

function mockFetch(status, body, { ok = status < 400 } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  })
}

describe('services/client', () => {
  beforeEach(() => {
    setAuthToken(null)
    setUnauthorizedHandler(null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends JSON with the bearer token and parses the response', async () => {
    const fetchMock = mockFetch(201, { id: 'ABC123' })
    vi.stubGlobal('fetch', fetchMock)
    setAuthToken('tok')

    const result = await api.post('/projects', { name: 'X' }, { query: { a: 1, empty: '' } })

    expect(result).toEqual({ id: 'ABC123' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/v1\/projects\?a=1$/)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"name":"X"}')
  })

  it('returns null for 204', async () => {
    vi.stubGlobal('fetch', mockFetch(204))
    expect(await api.delete('/goals/ABC123')).toBeNull()
  })

  it('maps the error envelope to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(400, { error: { code: 'VALIDATION_ERROR', message: 'bad', details: { field: 'name' } } }),
    )
    await expect(api.get('/projects')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'bad',
      details: { field: 'name' },
    })
  })

  it('calls the unauthorized handler on 401 except for login', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', mockFetch(401, { error: { code: 'UNAUTHENTICATED', message: 'nope' } }))

    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)

    await expect(api.post('/auth/login', { username: 'u', password: 'p' })).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('wraps network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.get('/health')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })
})
