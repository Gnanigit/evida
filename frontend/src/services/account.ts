import { apiRequest } from './api'

export type DeleteAccountResult = { message: string; id: string; files_removed: number }

// Permanently deletes the signed-in user's account and all of their data
// (conversations, messages, PDFs, search index, profile).
export function deleteAccount(): Promise<DeleteAccountResult> {
  return apiRequest<DeleteAccountResult>('/account/', { method: 'DELETE' })
}
