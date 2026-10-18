import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../../services/api'

type ConfirmDialogProps = {
  title: string
  message: ReactNode
  confirmLabel: string
  busyLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

// Centered confirmation modal (native <dialog>: above the whole page, traps
// focus, closes on Escape). Stays open with the error if onConfirm fails.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingId = useId()
  const messageId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  function requestClose() {
    if (!busy) onClose()
  }

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (confirmError) {
      setError(errorMessage(confirmError))
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={headingId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="modal-body">
        <h2 id={headingId} className="modal-title">
          {title}
        </h2>
        <p id={messageId} className="modal-message">
          {message}
        </p>

        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="button"
            onClick={requestClose}
            disabled={busy}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button-danger' : 'button-primary'}`}
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
