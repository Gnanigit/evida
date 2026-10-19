import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ellipsis, MessageSquare, Pencil, Pin, SquarePen, Trash2 } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { errorMessage } from '../../services/api'
import type { Conversation } from '../../types/api'
import { groupConversationsByDate } from '../../utils/groupConversations'
import Brand from '../common/Brand'
import ConfirmDialog from '../common/ConfirmDialog'
import { DocumentIcon, SidebarIcon } from '../common/icons'
import { usePopoverMenu, type PlaceMenu } from '../common/usePopoverMenu'
import AccountMenu from './AccountMenu'
import RenameConversationDialog from './RenameConversationDialog'
import type { ConversationsState } from './AppLayout'

type SidebarProps = {
  email: string | null
  conversations: ConversationsState
  onRetryConversations: () => void
  onRenameConversation: (conversationId: string, title: string) => Promise<void>
  onPinConversation: (conversationId: string, isPinned: boolean) => Promise<void>
  onDeleteConversation: (conversationId: string) => Promise<void>
  onNavigate: () => void
  // Desktop only: a narrow icon rail. The mobile drawer always shows the full sidebar.
  collapsed: boolean
  onToggleCollapsed: () => void
}

function rowClass({ isActive }: { isActive: boolean }) {
  return `sidebar-row${isActive ? ' active' : ''}`
}

export default function Sidebar({
  email,
  conversations,
  onRetryConversations,
  onRenameConversation,
  onPinConversation,
  onDeleteConversation,
  onNavigate,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const groups = useMemo(() => groupConversationsByDate(conversations.items), [conversations.items])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <Link to="/" className="sidebar-home" aria-label="Evida home" onClick={onNavigate}>
            <Brand />
          </Link>
          <img src="/evida-mark.png" alt="Evida" className="brand-mark" />
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <SidebarIcon />
          </button>
        </div>
        <Link
          to="/"
          className="sidebar-row sidebar-item sidebar-new"
          aria-label="New convo"
          title="New convo"
          onClick={onNavigate}
        >
          <SquarePen size={16} className="icon new-icon" aria-hidden="true" />
          <span className="sidebar-label">New convo</span>
        </Link>
        <NavLink
          to="/library"
          className={(state) => `${rowClass(state)} sidebar-item`}
          aria-label="Library"
          title="Library"
          onClick={onNavigate}
        >
          <DocumentIcon />
          <span className="sidebar-label">Library</span>
        </NavLink>
      </div>

      <nav className="sidebar-conversations" aria-label="Conversations">
        {conversations.loading ? (
          <div className="sidebar-skeleton" aria-busy="true" aria-label="Loading conversations">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="skeleton-bar" />
            ))}
          </div>
        ) : conversations.error ? (
          <div className="sidebar-note" role="alert" title={conversations.error}>
            Couldn't load conversations.{' '}
            <button type="button" className="text-button" onClick={onRetryConversations}>
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="sidebar-empty">
            <span className="sidebar-empty-icon" aria-hidden="true">
              <MessageSquare size={18} />
            </span>
            <p className="sidebar-empty-title">No chats yet</p>
            <p className="sidebar-empty-text">Your conversations will appear here.</p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="sidebar-group" aria-label={group.label}>
              <h2 className="sidebar-group-label">{group.label}</h2>
              <ul className="sidebar-list">
                {group.items.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    onNavigate={onNavigate}
                    onRename={onRenameConversation}
                    onPin={onPinConversation}
                    onDelete={onDeleteConversation}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      <div className="sidebar-footer">
        <AccountMenu email={email} />
      </div>
    </aside>
  )
}

type ConversationRowProps = {
  conversation: Conversation
  onNavigate: () => void
  onRename: (conversationId: string, title: string) => Promise<void>
  onPin: (conversationId: string, isPinned: boolean) => Promise<void>
  onDelete: (conversationId: string) => Promise<void>
}

const ROW_MENU_GAP = 4
const ROW_MENU_WIDTH = 168
const ROW_MENU_HEIGHT = 90
const VIEWPORT_MARGIN = 8

// Below the ⋯ button, starting at its left edge and opening rightward; shifted
// left only as far as needed to stay on screen. Flips above the button when
// near the bottom of the screen.
const placeRowMenu: PlaceMenu = (trigger) => {
  const maxLeft = window.innerWidth - VIEWPORT_MARGIN - ROW_MENU_WIDTH
  const left = Math.max(VIEWPORT_MARGIN, Math.min(trigger.left, maxLeft))

  if (trigger.bottom + ROW_MENU_GAP + ROW_MENU_HEIGHT > window.innerHeight - VIEWPORT_MARGIN) {
    return {
      left,
      bottom: window.innerHeight - trigger.top + ROW_MENU_GAP,
      transformOrigin: 'bottom left',
    }
  }
  return { left, top: trigger.bottom + ROW_MENU_GAP, transformOrigin: 'top left' }
}

// One conversation: ⋯ menu (Rename, Delete) and a pin toggle on the right.
// Rename and delete open centered dialogs.
function ConversationRow({
  conversation,
  onNavigate,
  onRename,
  onPin,
  onDelete,
}: ConversationRowProps) {
  const pinned = Boolean(conversation.is_pinned)
  const [pinning, setPinning] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  const [renaming, setRenaming] = useState(false)

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const {
    open: menuOpen,
    style: menuStyle,
    toggle: toggleMenu,
    close: closeMenu,
    triggerRef,
    menuRef,
    handleMenuKeyDown,
  } = usePopoverMenu(placeRowMenu)

  async function togglePin() {
    setPinning(true)
    setPinError(null)
    try {
      await onPin(conversation.id, !pinned)
    } catch (error) {
      setPinError(errorMessage(error))
    } finally {
      setPinning(false)
    }
  }

  return (
    <li className="conversation-item">
      <NavLink
        to={`/c/${conversation.id}`}
        className={(state) => `${rowClass(state)} conversation-link`}
        title={conversation.title}
        onClick={onNavigate}
        onDoubleClick={() => setRenaming(true)}
      >
        {conversation.title}
      </NavLink>

      <div className="conversation-actions">
        <button
          ref={triggerRef}
          type="button"
          className="conversation-action"
          aria-label={`Options for "${conversation.title}"`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Options"
          onClick={toggleMenu}
        >
          <Ellipsis size={16} aria-hidden="true" />
        </button>
        {/* Rightmost. Filled when the conversation is pinned. */}
        <button
          type="button"
          className={`conversation-action conversation-pin${pinned ? ' is-pinned' : ''}`}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin "${conversation.title}"` : `Pin "${conversation.title}"`}
          title={pinned ? 'Unpin' : 'Pin'}
          onClick={() => void togglePin()}
          disabled={pinning}
        >
          <Pin size={14} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      {pinError && (
        <p className="conversation-error" role="alert">
          Couldn&apos;t {pinned ? 'unpin' : 'pin'}. {pinError}
        </p>
      )}

      {/* Portaled to <body>: the sidebar's transform (mobile drawer) and overflow
          would otherwise reposition and clip this fixed menu. */}
      {menuStyle && createPortal(
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          aria-label={`Options for "${conversation.title}"`}
          style={menuStyle}
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              closeMenu()
              setRenaming(true)
            }}
          >
            <Pencil size={15} aria-hidden="true" />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item-danger"
            onClick={() => {
              closeMenu()
              setConfirmingDelete(true)
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete
          </button>
        </div>,
        document.body,
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete conversation?"
          message={
            <>
              <strong>{conversation.title}</strong> and all of its messages will be permanently
              deleted.
            </>
          }
          confirmLabel="Delete"
          busyLabel="Deleting…"
          danger
          onConfirm={() => onDelete(conversation.id)}
          onClose={() => setConfirmingDelete(false)}
        />
      )}

      {renaming && (
        <RenameConversationDialog
          currentTitle={conversation.title}
          onSave={(title) => onRename(conversation.id, title)}
          onClose={() => setRenaming(false)}
        />
      )}
    </li>
  )
}
