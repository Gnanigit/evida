import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ApiError, errorMessage } from '../../services/api'
import { getCurrentUser } from '../../services/auth'
import {
  deleteConversation,
  listConversations,
  pinConversation,
  renameConversation,
} from '../../services/conversations'
import Brand from '../common/Brand'
import type { Conversation, CurrentUser } from '../../types/api'
import type { AppContext } from './appContext'
import Sidebar from './Sidebar'

const SIDEBAR_COLLAPSED_KEY = 'evida:sidebar-collapsed'

// Remembered per browser; storage can be unavailable (e.g. private mode).
function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export type ConversationsState = {
  items: Conversation[]
  loading: boolean
  error: string | null
}

// Authenticated application shell: sidebar navigation plus the main workspace.
// On small screens the sidebar becomes a drawer opened from the top bar.
export default function AppLayout() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const openConversationId = useMatch('/c/:conversationId')?.params.conversationId
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
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

  // Errors propagate so the sidebar can show them on the conversation's row.
  // Updates the title in place, so the list keeps its order.
  async function handleRenameConversation(conversationId: string, title: string) {
    const updated = await renameConversation(conversationId, title)
    setConversations((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === conversationId ? { ...item, title: updated.title } : item,
      ),
    }))
  }

  // Updates the pin state in place; the sidebar regroups pinned conversations.
  async function handlePinConversation(conversationId: string, isPinned: boolean) {
    const updated = await pinConversation(conversationId, isPinned)
    setConversations((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === conversationId ? { ...item, is_pinned: Boolean(updated.is_pinned) } : item,
      ),
    }))
  }

  async function handleDeleteConversation(conversationId: string) {
    await deleteConversation(conversationId)
    if (conversationId === openConversationId) {
      navigate('/', { replace: true })
    }
    await refreshConversations()
  }

  function toggleSidebarCollapsed() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // Not remembered across visits; the toggle still works.
    }
  }

  function retryBackend() {
    void verifyBackendSession()
    void refreshConversations()
  }

  const outletContext = useMemo<AppContext>(
    () => ({ conversations: conversations.items, refreshConversations }),
    [conversations.items, refreshConversations],
  )

  return (
    <div
      className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}${
        sidebarCollapsed ? ' sidebar-collapsed' : ''
      }`}
    >
      <Sidebar
        email={currentUser?.email ?? session?.user.email ?? null}
        conversations={conversations}
        onRetryConversations={() => void refreshConversations()}
        onRenameConversation={handleRenameConversation}
        onPinConversation={handlePinConversation}
        onDeleteConversation={handleDeleteConversation}
        onNavigate={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
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
          <Brand />
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
