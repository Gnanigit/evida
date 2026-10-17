import type { CurrentUser } from '../types/api'
import { apiRequest } from './api'

// Confirms the Supabase session is accepted by FastAPI.
export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/auth/me')
}
