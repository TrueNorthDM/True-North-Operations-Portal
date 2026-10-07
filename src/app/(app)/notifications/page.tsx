// Notification settings (22 September 2026; one table with categories, the
// preview window and the daily summary email since 7 October 2026), opened
// from the two notification drawers. Every notification the portal has, the
// ones still to come faded, each with on/off and when. Admins get a second tab
// with the rules for everyone and how many people turned each one off, also
// reached from Admin > Configuration > Notification rules (?tab=rules). The
// catalogue is src/lib/notifications/catalogue.ts.
//
// Shown for the person this page renders as: in a View Stage preview, the
// previewed person's list and choices, read-only (the actions refuse to save
// from a preview).

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { NotificationSettings } from '@/components/NotificationSettings'
import { requireSurface } from '@/lib/access/resolve'
import { getCurrentPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { teamPositionLeads } from '@/lib/directory/people-types'
import { NOTIFICATION_TYPES, TYPE_BY_KEY, reaches } from '@/lib/notifications/catalogue'
import { loadAudience } from '@/lib/notifications/audience'
import { loadOffCounts, loadPrefs, loadRules, loadZones } from '@/lib/notifications/store'
import { saveNotificationPref, saveNotificationRule, saveTimeZone, sendTestNotification } from './actions'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = ReturnType<typeof createAdminClient>

/** Per type: how many people it reaches, and how many of them switched it off. */
async function offCountsFor(db: Db): Promise<Record<string, { off: number; reach: number }>> {
  const aud = await loadAudience(db as any)
  const off = await loadOffCounts(db as any, (key, personId) => {
    const t = TYPE_BY_KEY.get(key)
    const r = aud.byId.get(personId)
    return !!t && !!r && aud.reached(t, r)
  })
  return Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, { off: off[t.key] ?? 0, reach: aud.people.filter(r => aud.reached(t, r)).length }]))
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notification settings' }

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const access = await requireSurface('home')
  const me = await getCurrentPerson()
  const db = createAdminClient()
  const [{ rules, ready }, prefs, zones, { data: memberships }, offCounts] = await Promise.all([
    loadRules(db),
    me ? loadPrefs(db, [me.id]) : Promise.resolve(new Map()),
    me ? loadZones(db, [me.id]) : Promise.resolve(new Map<string, string>()),
    me ? db.from('team_members').select('position').eq('person_id', me.id) : Promise.resolve({ data: [] }),
    access.isAdmin ? offCountsFor(db) : Promise.resolve(undefined),
  ])
  const leads = ((memberships ?? []) as { position: string | null }[]).some(m => teamPositionLeads(m.position ?? 'collaborator'))
  const who = { isAdmin: access.isAdmin, leads, canTool: access.canTool }
  const mine = NOTIFICATION_TYPES.filter(t => !t.available || reaches(t, who)).map(t => t.key)

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb now="Notification settings" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Notification settings</h1>
        <p className="mt-1.5 text-muted leading-relaxed m-0">What notifies you, and when: in the bell as it happens, or in the daily summary email. Every notification the portal has, including the ones still to come.</p>
      </div>
      {!ready && (
        <div className="rounded-[12px] border border-[#f0d98a] bg-[#fbf1cf] px-4 py-3 text-[13px] text-[#6b5000]">
          Notifications need migration 088 in the database. Until it is run, nothing is sent and changes here are not saved.
        </div>
      )}
      {ready && !me && (
        <div className="rounded-[12px] border border-[#f0d98a] bg-[#fbf1cf] px-4 py-3 text-[13px] text-[#6b5000]">
          Your login is not linked to anyone in the Directory, so there is nobody to send notifications to. An admin can link it.
        </div>
      )}
      <NotificationSettings
        types={NOTIFICATION_TYPES}
        mine={mine}
        rules={rules}
        prefs={(me && prefs.get(me.id)) ?? {}}
        isAdmin={access.isAdmin}
        initialTab={access.isAdmin && tab === 'rules' ? 'rules' : 'mine'}
        savePref={saveNotificationPref}
        saveRule={access.isAdmin ? saveNotificationRule : null}
        zone={(me && zones.get(me.id)) ?? null}
        saveZone={saveTimeZone}
        sendTest={sendTestNotification}
        offCounts={offCounts}
        blocked={!ready ? 'Not saved: migration 088 is not in the database yet.' : !me ? 'Not saved: your login has no Directory person.' : undefined}
      />
    </div>
  )
}
