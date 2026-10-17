import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import type { ConversationsState } from './AppLayout'

type SidebarProps = {
  email: string | null
  conversations: ConversationsState
  onRetryConversations: () => void
  onNavigate: () => void
}

function navClass({ isActive }: { isActive: boolean }) {
  return `nav-item${isActive ? ' active' : ''}`
}

export default function Sidebar({
  email,
  conversations,
  onRetryConversations,
  onNavigate,
}: SidebarProps) {
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
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
            {conversations.items.map((conversation) => (
              <li key={conversation.id}>
                <NavLink
                  to={`/c/${conversation.id}`}
                  className={navClass}
                  title={conversation.title}
                  onClick={onNavigate}
                >
                  {conversation.title}
                </NavLink>
              </li>
            ))}
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
