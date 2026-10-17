import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { errorMessage } from '../../services/api'
import type { ConversationsState } from './AppLayout'

type SidebarProps = {
  email: string | null
  conversations: ConversationsState
  onRetryConversations: () => void
  onDeleteConversation: (conversationId: string) => Promise<void>
  onNavigate: () => void
}

function navClass({ isActive }: { isActive: boolean }) {
  return `nav-item${isActive ? ' active' : ''}`
}

export default function Sidebar({
  email,
  conversations,
  onRetryConversations,
  onDeleteConversation,
  onNavigate,
}: SidebarProps) {
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
  }

  async function handleDelete(conversationId: string) {
    setDeletingId(conversationId)
    setDeleteError(null)
    try {
      await onDeleteConversation(conversationId)
      setConfirmingId(null)
    } catch (error) {
      setDeleteError({ id: conversationId, message: errorMessage(error) })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="brand">Evida</span>
        <Link to="/" className="button button-primary" onClick={onNavigate}>
          New conversation
        </Link>
        <NavLink to="/documents" className={navClass} onClick={onNavigate}>
          Documents
        </NavLink>
      </div>

      <nav className="sidebar-section sidebar-conversations" aria-label="Conversations">
        <h2 className="sidebar-heading">Conversations</h2>

        {conversations.error && (
          <div className="alert alert-error small">
            <p>{conversations.error}</p>
            <button type="button" className="button button-small" onClick={onRetryConversations}>
              Retry
            </button>
          </div>
        )}

        {conversations.loading ? (
          <p className="muted small">Loading…</p>
        ) : conversations.items.length === 0 && !conversations.error ? (
          <p className="muted small">No conversations yet.</p>
        ) : (
          <ul className="nav-list">
            {conversations.items.map((conversation) => {
              const confirming = confirmingId === conversation.id
              const deleting = deletingId === conversation.id

              return (
                <li key={conversation.id}>
                  <div className="conversation-row">
                    <NavLink
                      to={`/c/${conversation.id}`}
                      className={navClass}
                      title={conversation.title}
                      onClick={onNavigate}
                    >
                      {conversation.title}
                    </NavLink>
                    {!confirming && (
                      <button
                        type="button"
                        className="conversation-delete"
                        aria-label={`Delete conversation "${conversation.title}"`}
                        title="Delete conversation"
                        onClick={() => {
                          setDeleteError(null)
                          setConfirmingId(conversation.id)
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {confirming && (
                    <div className="conversation-confirm small">
                      <span>Delete this conversation?</span>
                      <div className="conversation-confirm-actions">
                        <button
                          type="button"
                          className="button button-small button-danger"
                          onClick={() => void handleDelete(conversation.id)}
                          disabled={deleting}
                        >
                          {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => setConfirmingId(null)}
                          disabled={deleting}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {deleteError?.id === conversation.id && (
                    <p className="small status-error conversation-error" role="alert">
                      {deleteError.message}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="account-email small" title={email ?? undefined}>
          {email ?? 'Signed in'}
        </span>
        <button
          type="button"
          className="button button-small"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
