import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { errorMessage } from '../../services/api'

// Matches RenameConversationRequest.title in backend/app/api/conversations.py.
const MAX_TITLE_LENGTH = 200

type RenameConversationDialogProps = {
  currentTitle: string
  onSave: (title: string) => Promise<void>
  onClose: () => void
}

// Centered modal for renaming a conversation. Uses the native <dialog>, which
// sits above the whole page, traps focus, and closes on Escape.
export default function RenameConversationDialog({
  currentTitle,
  onSave,
  onClose,
}: RenameConversationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(currentTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingId = useId()
  const errorId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  function requestClose() {
    if (!saving) onClose()
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    const trimmed = title.trim()

    if (!trimmed) {
      setError('Title cannot be empty.')
      return
    }
    if (trimmed === currentTitle) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
      onClose()
    } catch (saveError) {
      setError(errorMessage(saveError))
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={headingId}
      onCancel={(event) => {
        // Escape: close through React state so the dialog unmounts cleanly.
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        // The form fills the dialog, so a click on the dialog itself is on the backdrop.
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <form className="modal-body" onSubmit={handleSubmit}>
        <h2 id={headingId} className="modal-title">
          Rename conversation
        </h2>

        <input
          className="modal-input"
          aria-label="Conversation title"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          readOnly={saving}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setTitle(event.target.value)
            setError(null)
          }}
        />

        {error && (
          <p id={errorId} className="modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="button" onClick={requestClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
