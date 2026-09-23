'use client'

/**
 * NotificationBell: the bell in the top bar. Added on 21 September 2026 as a
 * placeholder, and since 22 September a thin wrapper over NotificationButton,
 * which opens the Notifications drawer (Tools and System). Kept so the places
 * that import the bell do not churn.
 */

import { NotificationButton } from '@/components/NotificationButton'

export function NotificationBell({ startOpen = false }: {
  /** Design check only: show the drawer without a click. */
  startOpen?: boolean
} = {}) {
  return <NotificationButton kind="bell" startOpen={startOpen} />
}
