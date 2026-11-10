// Design check: the personal Settings page (7 October 2026), the real
// components with an admin's navigation and example choices: São Paulo time,
// summary at 7:00, three favourites. Nothing is saved. Development only.

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { NotificationSettings } from '@/components/NotificationSettings'
import { PersonalSettings } from '@/components/settings/PersonalSettings'
import { TwoStepSelf } from '@/components/mfa/TwoStepSelf'
import { NOTIFICATION_TYPES, defaultRule } from '@/lib/notifications/catalogue'
import { DEFAULT_SETTINGS } from '@/lib/settings/person'

export const dynamic = 'force-dynamic'

export default function SettingsCheck() {
  if (process.env.NODE_ENV === 'production') notFound()
  const settings = { ...DEFAULT_SETTINGS, timeZone: 'America/Sao_Paulo', summaryHour: 7, favourites: ['i7', 'publishing', 'my-team'] }
  return (
    <div className="min-h-screen bg-background p-8 space-y-8">
      <div className="space-y-5">
        <div>
          <Breadcrumb self="/settings" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Settings</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">How the portal works for you. Your choices follow you to any computer or phone. Company settings live in Admin, Configuration.</p>
        </div>
        <PersonalSettings
          settings={settings}
          zone={{ text: 'Brasília time (BRT), Sao Paulo', profileHref: '#' }}
          email="arnaldo.oliveira@me.com"
          save={null}
          signOutEverywhere={null}
          twoStep={<TwoStepSelf since="2026-09-28" daysLeft={null} />}
          notifications={
            <NotificationSettings
              mode="mine" types={NOTIFICATION_TYPES}
              rules={Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, defaultRule(t)]))}
              zone="America/Sao_Paulo" hour={7}
            />
          }
        />
      </div>
    </div>
  )
}
