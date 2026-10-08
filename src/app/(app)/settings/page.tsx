// Settings, under the avatar (7 October 2026): each person's own settings.
// The company-wide ones moved to Admin > Configuration > Company settings the
// same day; old links to their sub-pages still go there ([...rest]).
//
// Shown for the person this page renders as: in a View Stage preview, the
// previewed person's choices, and the actions refuse to save from a preview.

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { NotificationSettings } from '@/components/NotificationSettings'
import { PersonalSettings } from '@/components/settings/PersonalSettings'
import { TwoStepSelf } from '@/components/mfa/TwoStepSelf'
import { requireSurface } from '@/lib/access/resolve'
import { buildRail } from '@/lib/access/nav'
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
  const rail = buildRail({ can: access.can, canTool: access.canTool })
  const twoStepDays = !twoStep.hasFactor && twoStep.deadline ? twoStepDaysLeft(twoStep.deadline, new Date()) : null
  const blocked = viewAs ? 'View Stage is only a preview. Close it to change settings.' : !me ? 'Your login is not linked to anyone in the Directory.' : undefined

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb self="/settings" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Settings</h1>
        <p className="mt-1.5 text-muted leading-relaxed m-0">
          How the portal works for you. Your choices follow you to any computer or phone.
          {access.can('settings') && ' Company settings live in Admin, Configuration.'}
        </p>
      </div>
      <PersonalSettings
        settings={settings}
        email={user?.email ?? null}
        blocked={blocked}
        save={saveSettings}
        signOutEverywhere={signOutEverywhere}
        favourites={resolveFavourites(rail, settings.favourites)}
        groups={pinnable(rail)}
        twoStep={<TwoStepSelf since={twoStep.since} daysLeft={twoStepDays} />}
        notifications={
          <NotificationSettings
            types={NOTIFICATION_TYPES}
            mine={mine}
            rules={rules}
            prefs={(me && prefs.get(me.id)) ?? {}}
            isAdmin={access.isAdmin}
            only="mine"
            savePref={saveNotificationPref}
            saveRule={null}
            zone={settings.ownZone ? settings.timeZone : null}
            hour={settings.summaryHour}
            sendTest={sendTestNotification}
            blocked={!ready ? 'Not saved: migration 088 is not in the database yet.' : blocked}
          />
        }
      />
    </div>
  )
}
