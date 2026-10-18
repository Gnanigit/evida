export type QueueStatus = 'invalid' | 'waiting' | 'uploading' | 'indexing' | 'done' | 'error'

// One file in the upload queue. documentId is set once the upload succeeded,
// so a retry only needs to re-run indexing.
export type QueueItem = {
  id: string
  file: File
  status: QueueStatus
  error?: string
  documentId?: string
}

export type DocumentStatus = 'indexed' | 'indexing' | 'not-indexed' | 'failed'
