import { config } from '../config'
import { supabase } from './supabase'

// Dispatched when FastAPI rejects the access token; the auth provider signs out.
export const SESSION_EXPIRED_EVENT = 'evida:session-expired'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  json?: unknown
  formData?: FormData
}

// Call a protected FastAPI endpoint with the current Supabase access token.
export async function apiRequest<T>(
  path: string,
  { method = 'GET', json, formData }: RequestOptions = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new ApiError(401, 'You are not signed in.')
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  let body: BodyInit | undefined

  if (formData) {
    body = formData
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  let response: Response
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, { method, headers, body })
  } catch {
    throw new ApiError(
      0,
      'Could not reach the Evida server. Check that the backend is running and try again.',
    )
  }

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw new ApiError(response.status, await readErrorDetail(response))
  }

  return (await response.json()) as T
}

// FastAPI errors are { detail: string }, or { detail: [{ msg }] } for validation errors.
export async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    const detail = (body as { detail?: unknown } | null)?.detail

    if (typeof detail === 'string' && detail) {
      return detail
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => (item as { msg?: unknown })?.msg)
        .filter((msg): msg is string => typeof msg === 'string')
      if (messages.length > 0) {
        return messages.join('; ')
      }
    }
  } catch {
    // Not a JSON body; fall through to a generic message.
  }

  return fallbackMessage(response.status)
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have access to this resource.'
  if (status === 404) return 'Not found.'
  if (status >= 500) return 'The Evida server encountered an error. Please try again.'
  return `Request failed (${status}).`
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}
