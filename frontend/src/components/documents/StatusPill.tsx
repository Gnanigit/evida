import { CircleAlert, LoaderCircle } from 'lucide-react'
import type { DocumentStatus } from './types'

// Indexing status of a document, shown in the library row and the preview panel.
export default function StatusPill({ status, error }: { status: DocumentStatus; error?: string }) {
  switch (status) {
    case 'indexed':
      return (
        <span className="pill pill-success">
          <span className="pill-dot" aria-hidden="true" />
          Indexed
        </span>
      )
    case 'indexing':
      return (
        <span className="pill">
          <LoaderCircle size={12} className="spin" aria-hidden="true" />
          Indexing…
        </span>
      )
    case 'failed':
      return (
        <span className="pill pill-danger" title={error}>
          <CircleAlert size={12} aria-hidden="true" />
          Failed
        </span>
      )
    default:
      return <span className="pill pill-muted">Not indexed</span>
  }
}
