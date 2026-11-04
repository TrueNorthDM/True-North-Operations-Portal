'use client'

/**
 * A request form on a phone (Requests.dc.html 7Ap and 9Ap): the whole screen
 * under the portal's top bar instead of a window. Back and the page's place
 * at the top, the form scrolling in the middle, one wide button at the bottom.
 * The top bar stays above it, so the clock is still one tap away.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '@/components/ui/useModal'
import { useInPicture } from '@/components/ui/in-picture'
import { Icon, useIsClient } from '@/components/clocky/entries/ui'

export function PhoneSheet({ crumb, title, onBack, footer, children }: {
  /** "Requests · Time off" */
  crumb: string
  title: string
  onBack: () => void
  footer: ReactNode
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  // A System manual picture draws the sheet over the picture, not the page (ui/in-picture.ts).
  const inPicture = useInPicture()
  useModal(!inPicture, box, onBack)
  // Under the top bar, whatever its height (the staging strip adds to it).
  const client = useIsClient()
  useLayoutEffect(() => {
    if (box.current && !inPicture) box.current.style.top = `${Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom ?? 0)}px`
  }, [client, inPicture])
  if (!client && !inPicture) return null
  const sheet = (
    <div ref={box} role={inPicture ? undefined : 'dialog'} aria-modal={inPicture ? undefined : true} aria-label={title}
      className={`${inPicture ? 'absolute' : 'fixed'} inset-x-0 top-0 bottom-0 z-[30] bg-white flex flex-col leading-[normal]`}>
      <div className="flex-none flex items-center gap-2 px-3 pt-1.5 pb-2.5 border-b border-slate-200">
        <button type="button" onClick={onBack} aria-label="Back"
          className="w-11 h-11 flex-none border-0 rounded-[12px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle">
          <Icon d="M15 18l-6-6 6-6" size={20} width={2.2} />
        </button>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-[11.5px] text-muted font-semibold">{crumb}</span>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink tracking-normal">{title}</h2>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3.5">{children}</div>
      <div className="flex-none px-4 pt-3 pb-[26px] border-t border-[#eceff3] bg-white">{footer}</div>
    </div>
  )
  return inPicture ? sheet : createPortal(sheet, document.body)
}
