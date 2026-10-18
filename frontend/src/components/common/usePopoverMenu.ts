import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

// Places the menu (position: fixed) from the trigger's on-screen rectangle.
export type PlaceMenu = (trigger: DOMRect) => CSSProperties

// Shared behavior for small dropdown menus: fixed positioning (so the
// sidebar's overflow clipping cannot cut the menu off), focus on open,
// arrow-key navigation, and closing on outside click, Escape, scroll, or resize.
export function usePopoverMenu(place: PlaceMenu) {
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = style !== null

  const close = useCallback(() => setStyle(null), [])

  useEffect(() => {
    if (!open) return

    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setStyle(null)
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setStyle(null)
        triggerRef.current?.focus()
      }
    }
    function handleViewportChange() {
      setStyle(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open])

  function toggle() {
    if (open) {
      setStyle(null)
      return
    }
    const trigger = triggerRef.current
    if (trigger) setStyle(place(trigger.getBoundingClientRect()))
  }

  // Up/Down arrows move between the menu's items.
  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
    )
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    items[(current + step + items.length) % items.length].focus()
  }

  return { open, style, toggle, close, triggerRef, menuRef, handleMenuKeyDown }
}
