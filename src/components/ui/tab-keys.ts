import type { KeyboardEvent } from 'react'

/**
 * Arrow keys for a row of tabs (role="tablist"), the way screen readers and
 * keyboard users expect them: Left and Right move to the previous or next tab
 * and open it, Home and End to the first and last. Only the open tab is in
 * the Tab order (tabIndex 0, the others -1), so Tab leaves the row.
 *
 * Each tab button carries `data-tab={key}` so focus can follow the choice.
 */
export function tabKeys<K extends string>(keys: readonly K[], current: K, open: (k: K) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const i = keys.indexOf(current)
    const next =
      e.key === 'ArrowRight' ? keys[(i + 1) % keys.length]
      : e.key === 'ArrowLeft' ? keys[(i - 1 + keys.length) % keys.length]
      : e.key === 'Home' ? keys[0]
      : e.key === 'End' ? keys[keys.length - 1]
      : null
    if (!next) return
    e.preventDefault()
    open(next)
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
  }
}
