import { CircleAlert, FileText, LoaderCircle, X } from 'lucide-react'
import { formatFileSize } from '../../services/documents'
import type { Attachment } from './useAttachments'

type AttachmentChipsProps = {
  attachments: Attachment[]
  onRetry: (key: string) => void
  onRemove: (key: string) => void
}

function statusText(item: Attachment): string {
  switch (item.status) {
    case 'waiting':
      return 'Waiting…'
    case 'uploading':
      return 'Uploading…'
    case 'indexing':
      return 'Processing…'
    case 'ready':
      return item.size !== null ? formatFileSize(item.size) : 'PDF'
    default:
      return item.error ?? 'Failed'
  }
}

export default function AttachmentChips({ attachments, onRetry, onRemove }: AttachmentChipsProps) {
  if (attachments.length === 0) return null

  return (
    <ul className="attachment-chips" aria-label="Attached files" aria-live="polite">
      {attachments.map((item) => {
        const busy = item.status === 'waiting' || item.status === 'uploading' || item.status === 'indexing'
        const failed = item.status === 'error' || item.status === 'invalid'

        return (
          <li
            key={item.key}
            className={`attachment-chip${failed ? ' is-failed' : ''}`}
            title={item.error ?? item.name}
          >
            <span className="attachment-icon" aria-hidden="true">
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : failed ? (
                <CircleAlert size={16} />
              ) : (
                <FileText size={16} />
              )}
            </span>
            <span className="attachment-text">
              <span className="attachment-name">{item.name}</span>
              <span className="attachment-meta">{statusText(item)}</span>
            </span>
            {item.status === 'error' && (
              <button type="button" className="text-button attachment-retry" onClick={() => onRetry(item.key)}>
                Retry
              </button>
            )}
            <button
              type="button"
              className="attachment-remove"
              aria-label={`Remove ${item.name}`}
              title={busy ? 'Wait for processing to finish' : 'Remove'}
              onClick={() => onRemove(item.key)}
              disabled={busy}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
