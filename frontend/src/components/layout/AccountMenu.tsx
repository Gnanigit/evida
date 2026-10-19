import { useState } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { usePopoverMenu, type PlaceMenu } from '../common/usePopoverMenu'
import ProfileDialog, { type ProfileNames } from './ProfileDialog'

const MENU_GAP = 6

// Above the row in the expanded sidebar; to the right of the avatar in the collapsed rail.
const placeAccountMenu: PlaceMenu = (trigger) => {
  const fromBottom = window.innerHeight - trigger.bottom
  const isRail = trigger.width < 100
  return isRail
    ? { left: trigger.right + MENU_GAP * 2, bottom: fromBottom }
    : { left: trigger.left, width: trigger.width, bottom: fromBottom + trigger.height + MENU_GAP }
}

type AccountMenuProps = ProfileNames & { email: string | null }

// Avatar + first name row that opens a small account menu (Profile, Sign out).
export default function AccountMenu({ email, firstName, lastName }: AccountMenuProps) {
  const { signOut } = useAuth()
  const {
    open: menuOpen,
    style: menuStyle,
    toggle: toggleMenu,
    close: closeMenu,
    triggerRef,
    menuRef,
    handleMenuKeyDown,
  } = usePopoverMenu(placeAccountMenu)
  const [signingOut, setSigningOut] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // The row shows the first name; accounts created before names were
  // collected fall back to the email.
  const label = firstName || lastName || email || 'Signed in'
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const initial = (label.trim().charAt(0) || '?').toUpperCase()

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
          <div className="menu-label" title={email ?? label}>
            {email ?? label}
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              closeMenu()
              setShowProfile(true)
            }}
          >
            <UserRound size={15} aria-hidden="true" />
            Profile
          </button>
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
        aria-label={`Account menu for ${fullName || label}`}
        title={fullName || label}
        onClick={toggleMenu}
      >
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="sidebar-label">{label}</span>
      </button>

      {showProfile && (
        <ProfileDialog
          firstName={firstName}
          lastName={lastName}
          email={email}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  )
}
