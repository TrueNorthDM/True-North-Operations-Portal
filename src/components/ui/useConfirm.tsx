'use client'

/**
 * A confirmation in the portal's own dialog, in place of the browser's
 * window.confirm (audit, 8 October 2026): the browser's box cannot be styled,
 * reads as an alarm from another site, and in some browsers can be silenced
 * for the page by the person ("prevent this page from creating dialogs"),
 * after which every confirm answers no without asking.
 *
 *   const [confirmDialog, confirm] = useConfirm()
 *   if (!(await confirm({ title, body, action: 'Remove', danger: true }))) return
 *   ...
 *   return <>{confirmDialog}...</>
 *
 * Keyboard: focus starts on Cancel (the safe choice), Escape cancels, Tab
 * stays inside, and focus goes back to where it was.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BTN } from '@/lib/ui/buttons'

export interface ConfirmOptions {
  title: string
  body?: ReactNode
  /** The button that goes ahead, in words: "Remove", "Revoke access". */
  action: string
  /** A step that cannot be taken back: the button is red. */
  danger?: boolean
}

export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
  const [open, setOpen] = useState<ConfirmOptions | null>(null)
  const answer = useRef<((yes: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => {
    answer.current = resolve
    setOpen(o)
  }), [])

  const settle = (yes: boolean) => {
    answer.current?.(yes)
    answer.current = null
    setOpen(null)
  }

  const dialog = open ? <ConfirmBox options={open} onAnswer={settle} /> : null
  return [dialog, confirm]
}

function ConfirmBox({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (yes: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const answer = useRef(onAnswer)
  useEffect(() => { answer.current = onAnswer })

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); answer.current(false); return }
      if (e.key !== 'Tab') return
      const list = [...(box.current?.querySelectorAll<HTMLElement>('button') ?? [])]
      if (!list.length) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(1,35,88,.38)] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) answer.current(false) }}>
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={options.body ? 'confirm-body' : undefined}
        className="w-full max-w-[440px] bg-white rounded-[16px] shadow-[0_30px_60px_-20px_rgba(1,35,88,.55)] p-5 flex flex-col gap-3">
        <h2 id="confirm-title" className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">{options.title}</h2>
        {options.body && <div id="confirm-body" className="text-[13.5px] text-muted leading-relaxed">{options.body}</div>}
        <div className="flex justify-end gap-2.5 pt-1">
          <button ref={cancel} type="button" className={BTN.white} onClick={() => answer.current(false)}>Cancel</button>
          <button type="button" onClick={() => answer.current(true)}
            className={options.danger
              ? 'inline-flex items-center gap-2.5 bg-[#c8323d] text-[#ffffff] rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] hover:brightness-110'
              : BTN.navy}>
            {options.action}
          </button>
        </div>
      </div>
    </div>
  )
}
