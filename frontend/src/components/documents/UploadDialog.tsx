import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type UploadDialogProps = {
  onClose: () => void
  // The drop zone and the upload queue.
  children: ReactNode
}

// Centered modal for uploading PDFs to the library (native <dialog>: above the
// page, traps focus, closes on Escape). Uploads keep running after it closes.
export default function UploadDialog({ onClose, children }: UploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="modal upload-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // No close on backdrop click: a stray click (e.g. after dragging files)
      // shouldn't dismiss it. Close with ✕ or Escape.
    >
      <div className="modal-body">
        <div className="upload-modal-header">
          <h2 id={titleId} className="modal-title">
            Upload PDFs
          </h2>
          <button
            type="button"
            className="icon-action"
            aria-label="Close"
            title="Close (Esc)"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p className="modal-message">
          Files are added to your library and indexed so Evida can search them.
        </p>
        {children}
      </div>
    </dialog>
  )
}
