import { useEffect, useId, useRef, useState } from 'react'
import { CircleAlert, ExternalLink, FileText, MessageSquare, X } from 'lucide-react'
import { Link } from 'react-router'
import { errorMessage } from '../../services/api'
import { getDocumentUrl } from '../../services/documents'
import type { DocumentRecord } from '../../types/api'
import { relativeTime } from '../../utils/relativeTime'
import StatusPill from './StatusPill'
import type { DocumentStatus } from './types'

type DocumentPanelProps = {
  document: DocumentRecord
  status: DocumentStatus
  error?: string
  onClose: () => void
}

// PDF preview that slides in from the right. A native <dialog> keeps it above
// the page, traps focus, and closes on Escape. The PDF comes from a short-lived
// signed link fetched each time the panel opens.
export default function DocumentPanel({ document, status, error, onClose }: DocumentPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [tabError, setTabError] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    let ignore = false
    getDocumentUrl(document.id)
      .then((result) => {
        if (ignore) return
        setUrl(result.url)
        setLoadError(null)
      })
      .catch((fetchError: unknown) => {
        if (!ignore) setLoadError(errorMessage(fetchError))
      })
    return () => {
      ignore = true
    }
  }, [document.id, attempt])

  function retry() {
    setUrl(null)
    setLoadError(null)
    setAttempt((count) => count + 1)
  }

  // Always uses a fresh link, so it works even after the panel's link expired.
  async function openInNewTab() {
    setTabError(null)
    // Open the tab synchronously so popup blockers allow it, then point it at the PDF.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const result = await getDocumentUrl(document.id)
      if (tab) tab.location.href = result.url
      else window.location.assign(result.url)
    } catch (fetchError) {
      tab?.close()
      setTabError(errorMessage(fetchError))
    }
  }

  const uploaded = new Date(document.created_at)

  return (
    <dialog
      ref={dialogRef}
      className="doc-panel"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // The panel fills the dialog, so a click on the dialog itself is on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="doc-panel-inner">
        <header className="doc-panel-header">
          <span className="doc-tile" aria-hidden="true">
            <FileText size={16} />
          </span>

          <div className="doc-panel-heading">
            <h2 id={titleId} className="doc-panel-title" title={document.filename}>
              {document.filename}
            </h2>
            <div className="doc-meta">
              <span title={uploaded.toLocaleString()}>
                Uploaded {relativeTime(document.created_at)}
              </span>
              <StatusPill status={status} error={error} />
              {document.conversation_id && (
                <Link
                  to={`/c/${document.conversation_id}`}
                  className="doc-chat-tag"
                  title="Attached in this chat, and only searched there. Open the chat."
                  onClick={onClose}
                >
                  <MessageSquare size={12} aria-hidden="true" />
                  <span className="doc-chat-tag-text">
                    In chat: {document.conversation_title ?? 'Untitled conversation'}
                  </span>
                </Link>
              )}
            </div>
          </div>

          <div className="doc-panel-actions">
            <button
              type="button"
              className="icon-action"
              aria-label="Open in a new tab"
              title="Open in a new tab"
              onClick={() => void openInNewTab()}
            >
              <ExternalLink size={18} />
            </button>
            <button
              type="button"
              className="icon-action"
              aria-label="Close"
              title="Close (Esc)"
              onClick={onClose}
              autoFocus
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="doc-panel-body">
          {loadError ? (
            <div className="doc-panel-state" role="alert">
              <CircleAlert size={28} className="doc-panel-state-icon" aria-hidden="true" />
              <p>{loadError}</p>
              <button type="button" className="button button-small" onClick={retry}>
                Retry
              </button>
            </div>
          ) : url ? (
            <iframe className="doc-panel-frame" src={url} title={document.filename} />
          ) : (
            <div className="doc-panel-state" aria-busy="true">
              <span className="doc-panel-skeleton skeleton-bar" />
              <p className="muted">Loading document…</p>
            </div>
          )}
        </div>

        <footer className="doc-panel-footer">
          {tabError ? (
            <span className="status-error" role="alert">
              {tabError}
            </span>
          ) : (
            <span>
              Can&apos;t see the PDF?{' '}
              <button type="button" className="text-button" onClick={() => void openInNewTab()}>
                Open it in a new tab
              </button>
            </span>
          )}
        </footer>
      </div>
    </dialog>
  )
}
