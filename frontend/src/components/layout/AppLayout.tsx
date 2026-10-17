import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ApiError, errorMessage } from '../../services/api'
import { getCurrentUser } from '../../services/auth'
import { listConversations } from '../../services/conversations'
import type { Conversation, CurrentUser } from '../../types/api'
import type { AppContext } from './appContext'
import Sidebar from './Sidebar'

export type ConversationsState = {
  items: Conversation[]
  loading: boolean
  error: string | null
}

// Authenticated application shell: sidebar navigation plus the main workspace.
// On small screens the sidebar becomes a drawer opened from the top bar.
export default function AppLayout() {
  const { session } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationsState>({
    items: [],
    loading: true,
    error: null,
  })

  const verifyBackendSession = useCallback(async () => {
    try {
      setCurrentUser(await getCurrentUser())
      setBackendError(null)
    } catch (error) {
      // A 401 signs the user out; anything else means the API is unavailable.
      if (!(error instanceof ApiError && error.status === 401)) {
        setBackendError(errorMessage(error))
      }
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      const items = await listConversations()
      setConversations({ items, loading: false, error: null })
    } catch (error) {
      setConversations((previous) => ({
        ...previous,
        loading: false,
        error: errorMessage(error),
      }))
    }
  }, [])

  useEffect(() => {
    void verifyBackendSession()
    void refreshConversations()
  }, [verifyBackendSession, refreshConversations])

  function retryBackend() {
    void verifyBackendSession()
    void refreshConversations()
  }

  const outletContext = useMemo<AppContext>(
    () => ({ refreshConversations }),
    [refreshConversations],
  )

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <Sidebar
        email={currentUser?.email ?? session?.user.email ?? null}
        conversations={conversations}
        onRetryConversations={() => void refreshConversations()}
        onNavigate={() => setSidebarOpen(false)}
      />
      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="icon-button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="brand">Evida</span>
        </header>

        {backendError && (
          <div className="alert alert-error banner" role="alert">
            <span>{backendError}</span>
            <button type="button" className="button button-small" onClick={retryBackend}>
              Retry
            </button>
          </div>
        )}

        <main className="workspace-main">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  )
}
