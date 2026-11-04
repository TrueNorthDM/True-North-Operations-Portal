'use client'

/**
 * Page and section tabs: words in a row, a gold underline under the open one
 * (owner, 31 October 2026; gold since 4 November 2026). One control for every page that switches between
 * views of itself. The look lives in lib/ui/tabs.ts.
 *
 * Keyboard as a tab list is: only the open tab is in the Tab order, Left and
 * Right move to the previous or next tab and open it, Home and End to the
 * first and last. A tab with an `href` stays a link (the URL is the state);
 * the arrow keys follow the link.
 */

import Link from 'next/link'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { TAB_COUNT, TAB_COUNT_OFF, TAB_COUNT_ON, TAB_LIST, tabClass } from '@/lib/ui/tabs'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  /** A number after the label (left out when undefined). */
  count?: number | null
  /** Makes the tab a link. */
  href?: string
  /** Read out instead of the label (when the label is a symbol). */
  ariaLabel?: string
  title?: string
}

export function Tabs<K extends string>({ items, value, onChange, label, className, idPrefix, controls, scroll }: {
  items: readonly TabItem<K>[]
  value: K | null | undefined
  onChange?: (k: K) => void
  /** Names the tab list for a screen reader. */
  label: string
  /** Extra classes on the list (margins, placement). */
  className?: string
  /** Gives each tab the id `${idPrefix}-${key}`. */
  idPrefix?: string
  /** The id of the panel the tabs control. */
  controls?: string
  /** Links only: passed to next/link. */
  scroll?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = Math.max(0, items.findIndex(t => t.key === value))
    const n = items.length
    const to = e.key === 'ArrowRight' ? (i + 1) % n
      : e.key === 'ArrowLeft' ? (i - 1 + n) % n
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : -1
    if (to < 0) return
    e.preventDefault()
    const el = box.current?.querySelectorAll<HTMLElement>('[role="tab"]')[to]
    el?.focus()
    if (items[to].href) el?.click()
    else onChange?.(items[to].key)
  }
  return (
    <div ref={box} role="tablist" aria-label={label} onKeyDown={onKeyDown} className={`${TAB_LIST} ${className ?? ''}`}>
      {items.map(t => {
        const on = t.key === value
        const common = {
          role: 'tab' as const,
          'aria-selected': on,
          'aria-controls': controls,
          'aria-label': t.ariaLabel,
          id: idPrefix ? `${idPrefix}-${t.key}` : undefined,
          'data-tab': t.key,
          tabIndex: on || (value == null && t === items[0]) ? 0 : -1,
          title: t.title,
          className: tabClass(on),
        }
        const body = (
          <>
            {t.label}
            {t.count != null && <span className={`${TAB_COUNT} ${on ? TAB_COUNT_ON : TAB_COUNT_OFF}`}>{t.count}</span>}
          </>
        )
        return t.href
          ? <Link key={t.key} href={t.href} scroll={scroll} {...common} onClick={() => onChange?.(t.key)}>{body}</Link>
          : <button key={t.key} type="button" {...common} onClick={() => onChange?.(t.key)}>{body}</button>
      })}
    </div>
  )
}
