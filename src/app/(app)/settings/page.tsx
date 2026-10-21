// Settings, under the avatar (7 October 2026): each person's own settings.
// The company-wide ones moved to Admin > Configuration > Company settings the
// same day; old links to their sub-pages still go there ([...rest]).
//
// Shown for the person this page renders as: in a View Stage preview, the
// previewed person's choices, and the actions refuse to save from a preview.

import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { NotificationSettings } from '@/components/NotificationSettings'
import { PersonalSettings } from '@/components/settings/PersonalSettings'
import { TwoStepSelf } from '@/components/mfa/TwoStepSelf'
import { requireSurface } from '@/lib/access/resolve'
import { buildRail } from '@/lib/access/nav'
import { loadNavFacts } from '@/lib/access/nav-facts'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'
import { getViewAs } from '@/lib/auth/view-as-server'
import { checkTwoStep } from '@/lib/auth/two-step'
import { daysLeft as twoStepDaysLeft } from '@/lib/auth/two-step-rule'
import { createAdminClient } from '@/lib/supabase/admin'
import { teamPositionLeads } from '@/lib/directory/people-types'
import { NOTIFICATION_TYPES, reaches } from '@/lib/notifications/catalogue'
import { loadPrefs, loadRules } from '@/lib/notifications/store'
import { DEFAULT_SETTINGS, loadSettings } from '@/lib/settings/person'
import { pinnable, resolveFavourites } from '@/lib/settings/pages'
import { saveNotificationPref, sendTestNotification } from '../notifications/actions'
import { signOutEverywhere } from '@/app/auth/actions'
import { saveSettings } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const access = await requireSurface('home')
  const [me, user, viewAs, twoStep] = await Promise.all([getCurrentPerson(), getSessionUser(), getViewAs(), checkTwoStep()])
  const db = createAdminClient()
  const [settings, { rules, ready }, prefs, { data: memberships }] = await Promise.all([
    me ? loadSettings(db, me.id) : Promise.resolve({ ...DEFAULT_SETTINGS }),
    loadRules(db),
    me ? loadPrefs(db, [me.id]) : Promise.resolve(new Map()),
    me ? db.from('team_members').select('position').eq('person_id', me.id) : Promise.resolve({ data: [] }),
  ])

  const leads = ((memberships ?? []) as { position: string | null }[]).some(m => teamPositionLeads(m.position ?? 'collaborator'))
  const mine = NOTIFICATION_TYPES.filter(t => !t.available || reaches(t, { isAdmin: access.isAdmin, leads, canTool: access.can })).map(t => t.key)
  const rail = buildRail({ can: access.can, canTool: access.canTool, facts: await loadNavFacts(access) })
  const twoStepDays = !twoStep.hasFactor && twoStep.deadline ? twoStepDaysLeft(twoStep.deadline, new Date()) : null
  const blocked = viewAs ? 'View Stage is only a preview. Close it to change settings.' : !me ? 'Your login is not linked to anyone in the Directory.' : undefined

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb self="/settings" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Settings</h1>
        <p className="mt-1.5 text-muted leading-relaxed m-0">
          How the portal works for you. Your choices follow you to any computer or phone.
          {access.can('settings') && <> Company settings are in <Link href="/admin/settings" className="text-tn-teal font-semibold">Admin &gt; Configuration</Link>.</>}
        </p>
      </div>
      <PersonalSettings
        settings={settings}
        // The person on screen: in View Stage, theirs, not the session's.
        email={me?.email ?? user?.email ?? null}
        blocked={blocked}
        save={saveSettings}
        signOutEverywhere={signOutEverywhere}
        favourites={resolveFavourites(rail, settings.favourites)}
        groups={pinnable(rail)}
        twoStep={viewAs ? <p className="m-0 text-[13px] text-muted">Not shown in View Stage: two-step sign-in belongs to the account, not the level.</p> : <TwoStepSelf since={twoStep.since} daysLeft={twoStepDays} blocked={blocked} />}
        notifications={
          <NotificationSettings
            mode="mine"
            // Only what can reach this person, and only those rules: the
            // rest of the catalogue is not theirs to read (audit, 9 October 2026).
            types={NOTIFICATION_TYPES.filter(t => mine.includes(t.key))}
            rules={Object.fromEntries(mine.filter(k => rules[k]).map(k => [k, rules[k]]))}
            prefs={(me && prefs.get(me.id)) ?? {}}
            savePref={saveNotificationPref}
            zone={settings.ownZone ? settings.timeZone : null}
            hour={settings.summaryHour}
            sendTest={sendTestNotification}
            blocked={!ready ? 'Notification choices cannot be saved right now.' : blocked}
          />
        }
      />
    </div>
  )
}
