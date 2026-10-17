import type { DeleteResult, DocumentRecord, IndexResult } from '../types/api'
import { apiRequest } from './api'

// Matches MAX_FILE_SIZE in backend/app/api/documents.py. The backend still validates.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export async function listDocuments(): Promise<DocumentRecord[]> {
  const data = await apiRequest<{ documents: DocumentRecord[] }>('/documents/')
  return data.documents
}

export function uploadDocument(file: File): Promise<DocumentRecord> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest<DocumentRecord>('/documents/', { method: 'POST', formData })
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
