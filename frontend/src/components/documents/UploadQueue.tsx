import { CircleAlert, CircleCheck, LoaderCircle, X } from 'lucide-react'
import { formatFileSize } from '../../services/documents'
import type { QueueItem, QueueStatus } from './types'

const STATUS_TEXT: Record<QueueStatus, string> = {
  invalid: '',
  waiting: 'Waiting…',
  uploading: 'Uploading…',
  indexing: 'Indexing…',
  done: 'Ready',
  error: '',
}

type UploadQueueProps = {
  items: QueueItem[]
  onRetry: (id: string) => void
  onDismiss: (id: string) => void
}

function StatusIcon({ status }: { status: QueueStatus }) {
  if (status === 'done') return <CircleCheck size={18} />
  if (status === 'invalid' || status === 'error') return <CircleAlert size={18} />
  if (status === 'waiting') return <span className="queue-waiting-dot" />
  return <LoaderCircle size={18} className="spin" />
}

export default function UploadQueue({ items, onRetry, onDismiss }: UploadQueueProps) {
  if (items.length === 0) return null

  return (
    <ul className="upload-queue" aria-label="Uploads" aria-live="polite">
      {items.map((item) => {
        const busy = item.status === 'uploading' || item.status === 'indexing'
        const failed = item.status === 'invalid' || item.status === 'error'
        const finished = failed || item.status === 'done'

        return (
          <li key={item.id} className={`queue-item is-${item.status}`}>
            <span className="queue-icon" aria-hidden="true">
              <StatusIcon status={item.status} />
            </span>

            <div className="queue-main">
              <div className="queue-top">
                <span className="queue-name" title={item.file.name}>
                  {item.file.name}
                </span>
                <span className="queue-size">{formatFileSize(item.file.size)}</span>
              </div>
              <span className="queue-status">{failed ? item.error : STATUS_TEXT[item.status]}</span>
              {busy && (
                <span className="progress" role="progressbar" aria-label={STATUS_TEXT[item.status]}>
                  <span className="progress-bar" />
                </span>
              )}
            </div>

            {item.status === 'error' && (
              <button type="button" className="text-button" onClick={() => onRetry(item.id)}>
                Retry
              </button>
            )}
            {finished && (
              <button
                type="button"
                className="icon-action"
                aria-label={`Dismiss ${item.file.name}`}
                title="Dismiss"
                onClick={() => onDismiss(item.id)}
              >
                <X size={16} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
