import { useEffect, useId, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { deleteAccount } from '../../services/account'
import { errorMessage } from '../../services/api'

export type ProfileNames = { firstName: string | null; lastName: string | null }

type ProfileDialogProps = ProfileNames & {
  email: string | null
  onClose: () => void
}

// The user types this to enable the delete button.
const CONFIRM_WORD = 'DELETE'

// View-only account details (native <dialog>: above the page, closes on Escape
// or a backdrop click). Accounts created before names were collected show "Not set".
// "Delete account" switches the same dialog to a confirmation step.
export default function ProfileDialog({ firstName, lastName, email, onClose }: ProfileDialogProps) {
  const { signOut } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const confirmInputId = useId()

  const [step, setStep] = useState<'profile' | 'confirm-delete'>('profile')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  // Closing is blocked while the deletion is in flight.
  function requestClose() {
    if (!deleting) onClose()
  }

  function backToProfile() {
    setStep('profile')
    setConfirmText('')
    setDeleteError(null)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      // The account no longer exists: clear the session; the route guard
      // then shows the sign-in page.
      await signOut()
    } catch (error) {
      setDeleteError(errorMessage(error))
      setDeleting(false)
    }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const initial = (firstName || lastName || email || '?').trim().charAt(0).toUpperCase()
  const canDelete = confirmText.trim() === CONFIRM_WORD && !deleting

  const rows = [
    { label: 'First name', value: firstName },
    { label: 'Last name', value: lastName },
    { label: 'Email', value: email },
  ]

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      {step === 'profile' ? (
        <div className="modal-body">
          <h2 id={headingId} className="modal-title">
            Profile
          </h2>

          <div className="profile-summary">
            <span className="avatar avatar-large" aria-hidden="true">
              {initial}
            </span>
            <div className="profile-summary-text">
              <span className="profile-name">{fullName || 'Name not set'}</span>
              {email && <span className="profile-email">{email}</span>}
            </div>
          </div>

          <dl className="profile-details">
            {rows.map((row) => (
              <div key={row.label} className="profile-row">
                <dt>{row.label}</dt>
                <dd className={row.value ? undefined : 'muted'}>{row.value || 'Not set'}</dd>
              </div>
            ))}
          </dl>

          <div className="modal-actions profile-actions">
            <button
              type="button"
              className="text-button profile-delete"
              onClick={() => setStep('confirm-delete')}
            >
              Delete account
            </button>
            <button type="button" className="button" onClick={onClose} autoFocus>
              Close
            </button>
          </div>
        </div>
      ) : (
        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault()
            if (canDelete) void handleDelete()
          }}
        >
          <h2 id={headingId} className="modal-title">
            Delete your account?
          </h2>

          <div className="delete-caution" role="note">
            <TriangleAlert size={18} className="delete-caution-icon" aria-hidden="true" />
            <div>
              <p className="delete-caution-title">This is permanent and can&apos;t be undone.</p>
              <p>All of your data will be deleted forever:</p>
              <ul>
                <li>Every conversation and message</li>
                <li>Every uploaded PDF and its search index</li>
                <li>Your profile and sign-in ({email ?? 'this account'})</li>
              </ul>
            </div>
          </div>

          <label className="field" htmlFor={confirmInputId}>
            <span>
              Type <strong>{CONFIRM_WORD}</strong> to confirm
            </span>
          </label>
          <input
            id={confirmInputId}
            className="modal-input"
            autoComplete="off"
            spellCheck={false}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            disabled={deleting}
            autoFocus
          />

          {deleteError && (
            <p className="modal-error" role="alert">
              {deleteError}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button" onClick={backToProfile} disabled={deleting}>
              Cancel
            </button>
            <button type="submit" className="button button-danger" disabled={!canDelete}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
