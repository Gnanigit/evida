import type { DeleteResult, DocumentRecord, IndexResult } from '../types/api'
import { apiRequest } from './api'

// Matches MAX_FILE_SIZE in backend/app/api/documents.py. The backend still validates.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

type ListOptions = {
  // Only this conversation's attachments.
  conversationId?: string
  // The library plus every chat attachment (tagged with conversation_title).
  includeAttachments?: boolean
}

// With no options: the library only.
export async function listDocuments({
  conversationId,
  includeAttachments,
}: ListOptions = {}): Promise<DocumentRecord[]> {
  const params = new URLSearchParams()
  if (conversationId) params.set('conversation_id', conversationId)
  else if (includeAttachments) params.set('include_attachments', 'true')
  const query = params.toString()
  const data = await apiRequest<{ documents: DocumentRecord[] }>(
    `/documents/${query ? `?${query}` : ''}`,
  )
  return data.documents
}

// With a conversation ID the file is attached to that chat instead of the library.
export function uploadDocument(file: File, conversationId?: string): Promise<DocumentRecord> {
  const formData = new FormData()
  formData.append('file', file)
  if (conversationId) formData.append('conversation_id', conversationId)
  return apiRequest<DocumentRecord>('/documents/', { method: 'POST', formData })
}

// Short-lived signed link for viewing one of the user's own PDFs.
export function getDocumentUrl(documentId: string): Promise<{ url: string; expires_in: number }> {
  return apiRequest<{ url: string; expires_in: number }>(
    `/documents/${encodeURIComponent(documentId)}/url`,
  )
}

export function indexDocument(documentId: string): Promise<IndexResult> {
  return apiRequest<IndexResult>(`/documents/${encodeURIComponent(documentId)}/index`, {
    method: 'POST',
  })
}

export function deleteDocument(documentId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(`/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
}

// Client-side checks for usability only; returns an error message or null.
export function validatePdfFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are allowed.'
  }
  if (file.size === 0) {
    return 'The selected file is empty.'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'The file must be 10 MB or smaller.'
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
