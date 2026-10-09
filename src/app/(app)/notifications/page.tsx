// Admin > Configuration > Notification rules (22 September 2026; since 7
// October 2026 the rules alone). The rule for everyone each notification
// reaches, and how many people turned each one off. A person's own
// notification choices live in Settings (/settings#notifications), and anyone
// who arrives here without being an admin, or without ?tab=rules, is sent
// there. The catalogue is src/lib/notifications/catalogue.ts.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { NotificationSettings } from '@/components/NotificationSettings'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { NOTIFICATION_TYPES, TYPE_BY_KEY } from '@/lib/notifications/catalogue'
import { loadAudience } from '@/lib/notifications/audience'
import { loadOffCounts, loadRules } from '@/lib/notifications/store'
import { saveNotificationRule } from './rule-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notification rules' }

type Db = ReturnType<typeof createAdminClient>

/** Per type: how many people it reaches, and how many of them switched it off. */
async function offCountsFor(db: Db): Promise<Record<string, { off: number; reach: number }>> {
  const aud = await loadAudience(db)
  const off = await loadOffCounts(db, (key, personId) => {
    const t = TYPE_BY_KEY.get(key)
    const r = aud.byId.get(personId)
    return !!t && !!r && aud.reached(t, r)
  })
  return Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, { off: off[t.key] ?? 0, reach: aud.people.filter(r => aud.reached(t, r)).length }]))
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const access = await requireSurface('home')
  if (!access.can('notification-rules') || tab !== 'rules') redirect(await previewHref('/settings#notifications'))
  const db = createAdminClient()
  const [{ rules, ready }, offCounts] = await Promise.all([loadRules(db), offCountsFor(db)])

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin'))]} now="Notification rules" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Notification rules</h1>
        <p className="mt-1.5 text-muted leading-relaxed m-0">The default for everyone, and which choices people may change. Your own notifications are in Settings.</p>
      </div>
      {!ready && (
        <div className="rounded-[12px] border border-[#f0d98a] bg-[#fbf1cf] px-4 py-3 text-[13px] text-[#6b5000]">
          Notifications need migration 088 in the database. Until it is run, nothing is sent and changes here are not saved.
        </div>
      )}
      <NotificationSettings
        mode="rules"
        types={NOTIFICATION_TYPES}
        rules={rules}
        saveRule={saveNotificationRule}
        offCounts={offCounts}
        blocked={!ready ? 'Notification rules cannot be saved right now.' : undefined}
      />
    </div>
  )
}
