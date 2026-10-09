'use client'

/**
 * What a modal window owes the keyboard (audit, 9 October 2026): focus goes in
 * when it opens and back where it was when it closes, Tab stays inside, Escape
 * closes it, and the page behind stops scrolling. A confirmation opened on top
 * of it (useConfirm's alertdialog) answers its own keys, so Escape there closes
 * the confirmation, not the window under it.
 */

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useModal(open: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close })

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus())

    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return }
      if (e.key !== 'Tab') return
      const list = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      if (!list.length) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      before?.focus?.()
    }
  }, [open, box])
}
