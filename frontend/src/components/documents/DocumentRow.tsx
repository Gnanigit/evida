import { FileText, MessageSquare, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import type { DocumentRecord } from '../../types/api'
import { relativeTime } from '../../utils/relativeTime'
import StatusPill from './StatusPill'
import type { DocumentStatus } from './types'

type DocumentRowProps = {
  document: DocumentRecord
  status: DocumentStatus
  error?: string
  // Indexing is automatic; this only retries after a failure.
  onRetry: () => void
  onDelete: () => void
  onOpen: () => void
}

// One library row: file tile, name and upload time, actions, then status last.
export default function DocumentRow({
  document,
  status,
  error,
  onRetry,
  onDelete,
  onOpen,
}: DocumentRowProps) {
  const uploaded = new Date(document.created_at)

  return (
    <li
      className="doc-row"
      onClick={(event) => {
        // Clicking anywhere on the row opens it, except on its own buttons and links.
        if (!(event.target as HTMLElement).closest('button, a')) onOpen()
      }}
    >
      <span className="doc-tile" aria-hidden="true">
        <FileText size={20} />
      </span>

      <div className="doc-main">
        <button
          type="button"
          className="doc-name doc-open"
          title={`Open ${document.filename}`}
          onClick={onOpen}
        >
          {document.filename}
        </button>
        <span className="doc-meta">
          <span title={uploaded.toLocaleString()}>Uploaded {relativeTime(document.created_at)}</span>
          {document.conversation_id && (
            <Link
              to={`/c/${document.conversation_id}`}
              className="doc-chat-tag"
              title="Attached in this chat, and only searched there. Open the chat."
            >
              <MessageSquare size={12} aria-hidden="true" />
              <span className="doc-chat-tag-text">
                In chat: {document.conversation_title ?? 'Untitled conversation'}
              </span>
            </Link>
          )}
        </span>
      </div>

      <div className="doc-actions">
        <button
          type="button"
          className="icon-action icon-action-danger"
          aria-label={`Delete ${document.filename}`}
          title={status === 'indexing' ? 'Wait for indexing to finish' : 'Delete'}
          onClick={onDelete}
          disabled={status === 'indexing'}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="doc-status" aria-live="polite">
        <StatusPill status={status} error={error} />
        {status === 'failed' && (
          <button type="button" className="text-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </li>
  )
}
