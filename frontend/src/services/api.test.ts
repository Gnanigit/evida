import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()

vi.mock('../config', () => ({
  config: { apiBaseUrl: 'http://api.test', supabaseUrl: 'x', supabasePublishableKey: 'x' },
}))
vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }))

const { ApiError, SESSION_EXPIRED_EVENT, apiRequest } = await import('./api')

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiRequest', () => {
  const fetchMock = vi.fn()
  const windowTarget = new EventTarget()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', windowTarget)
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    getSession.mockReset()
  })

  it('sends the Supabase access token as a bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', email: 'a@b.c' }))

    const result = await apiRequest('/auth/me')

    expect(result).toEqual({ id: 'u1', email: 'a@b.c' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/auth/me')
    expect(init.headers.Authorization).toBe('Bearer token-123')
  })

  it('sends JSON bodies with a content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'c1' }))

    await apiRequest('/conversations/', { method: 'POST', json: { title: 'Hi' } })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"title":"Hi"}')
  })

  it('does not call the API without a session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces the FastAPI detail message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: 'Conversation not found.' }))

    await expect(apiRequest('/conversations/x/messages/')).rejects.toEqual(
      new ApiError(404, 'Conversation not found.'),
    )
  })

  it('joins FastAPI validation errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, { detail: [{ msg: 'Field required' }, { msg: 'Too long' }] }),
    )

    await expect(apiRequest('/chat/')).rejects.toMatchObject({
      status: 422,
      message: 'Field required; Too long',
    })
  })

  it('announces an expired session on 401', async () => {
    const listener = vi.fn()
    windowTarget.addEventListener(SESSION_EXPIRED_EVENT, listener)
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Invalid or expired access token' }))

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledTimes(1)
    windowTarget.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })

  it('does not sign out on 403', async () => {
    const listener = vi.fn()
    windowTarget.addEventListener(SESSION_EXPIRED_EVENT, listener)
    fetchMock.mockResolvedValue(new Response('nope', { status: 403 }))

    await expect(apiRequest('/documents/')).rejects.toMatchObject({
      status: 403,
      message: 'You do not have access to this resource.',
    })
    expect(listener).not.toHaveBeenCalled()
    windowTarget.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })

  it('reports an unreachable backend as a recoverable error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ status: 0 })
  })
})
