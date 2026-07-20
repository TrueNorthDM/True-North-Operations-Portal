'use client'

// Fires one access-log entry per visit, throttled client-side so navigating
// between pages (or opening several tabs) within the window records just once.

import { useEffect } from 'react'
import { logAccess } from '@/app/(app)/access-actions'

const KEY = 'tn-access-logged-at'
const THROTTLE_MS = 30 * 60 * 1000 // 30 minutes

export function AccessPing() {
  useEffect(() => {
    let last = 0
    try { last = Number(window.localStorage.getItem(KEY) || 0) } catch {}
    if (Date.now() - last < THROTTLE_MS) return
    try { window.localStorage.setItem(KEY, String(Date.now())) } catch {}
    logAccess().catch(() => {})
  }, [])
  return null
}
