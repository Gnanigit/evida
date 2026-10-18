import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { usePopoverMenu, type PlaceMenu } from '../common/usePopoverMenu'

const MENU_GAP = 6

// Above the row in the expanded sidebar; to the right of the avatar in the collapsed rail.
const placeAccountMenu: PlaceMenu = (trigger) => {
  const fromBottom = window.innerHeight - trigger.bottom
  const isRail = trigger.width < 100
  return isRail
    ? { left: trigger.right + MENU_GAP * 2, bottom: fromBottom }
    : { left: trigger.left, width: trigger.width, bottom: fromBottom + trigger.height + MENU_GAP }
}

// Avatar + email row that opens a small account menu.
export default function AccountMenu({ email }: { email: string | null }) {
  const { signOut } = useAuth()
  const {
    open: menuOpen,
    style: menuStyle,
    toggle: toggleMenu,
    triggerRef,
    menuRef,
    handleMenuKeyDown,
  } = usePopoverMenu(placeAccountMenu)
  const [signingOut, setSigningOut] = useState(false)

  const label = email ?? 'Signed in'
  const initial = (email?.trim().charAt(0) || '?').toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
  }

  return (
    <div className="account">
      {menuStyle && (
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          aria-label="Account"
          style={menuStyle}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="menu-label" title={label}>
            {label}
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
          >
            <LogOut size={15} aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        className="sidebar-row sidebar-item account-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Account menu for ${label}`}
        title={label}
        onClick={toggleMenu}
      >
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="sidebar-label">{label}</span>
      </button>
    </div>
  )
}
