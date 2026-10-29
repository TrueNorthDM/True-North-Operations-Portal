/**
 * The page side of the North Time lock (north-time-lock.ts, migration 132):
 * while North Time is closed, its person-facing pages (Time entries,
 * Approvals, Invoices, Who's working, Requests) send everyone but a Super
 * Admin back Home. A Super Admin still opens them, and every save is refused.
 */

import { redirect } from 'next/navigation'
import { loadAccess } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { northTimeOpen } from './north-time-lock'

export async function requireNorthTimeOpen(): Promise<void> {
  if (await northTimeOpen()) return
  if ((await loadAccess()).isSuperAdmin) return
  redirect(await previewHref('/'))
}
