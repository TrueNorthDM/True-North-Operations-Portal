'use client'

/**
 * How a Topic Studio tab runs a save: call the action, show its sentence in the
 * portal's toast (the person's own wording for a refusal, one generic line when
 * the network fails), and refresh the page's data so every tab reads the same
 * topic. `busy` is true while a save is running, for buttons to rest.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast, type ToastState } from '@/components/clocky/entries/ui'
import { isStalePage, failText } from '@/lib/ui/action-error'
import type { Done } from '../actions'

export function useTopicCall() {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((text: string, error = false) => {
    setToast({ text, error })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 5000)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /** Runs `fn`; returns its answer when it worked, null when it did not (the toast says why). */
  const call = useCallback(async <T extends object>(fn: () => Promise<Done<T>>, opts: { refresh?: boolean; ok?: string | ((r: T) => string | undefined); fail?: string } = {}): Promise<T | null> => {
    setBusy(true)
    try {
      const r = await fn()
      if (!r.ok) { say(r.error, true); return null }
      const msg = typeof opts.ok === 'function' ? opts.ok(r) : opts.ok
      if (msg) say(msg)
      if (opts.refresh !== false) router.refresh()
      return r
    } catch (e) {
      say(opts.fail && !isStalePage(e) ? opts.fail : failText(e), true)
      return null
    } finally {
      setBusy(false)
    }
  }, [router, say])

  return { call, busy, say, toast: <Toast toast={toast} /> }
}
