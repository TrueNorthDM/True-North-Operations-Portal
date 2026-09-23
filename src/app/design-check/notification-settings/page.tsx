// Design check: the Notification settings page (22 September 2026), the real
// component on the real catalogue with each notification's default rule.
// Nothing is saved. ?level=user | lead | admin (admin by default) shows what
// each level is offered; ?tab=rules opens the admin's rules. Two example locks
// are set so the locked look can be seen: "a new step was assigned to you"
// cannot be turned off, and "your team's priority order changed" always comes
// in the daily summary. Development only.

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { NotificationSettings } from '@/components/NotificationSettings'
import { NOTIFICATION_TYPES, defaultRule, reaches, type Rule } from '@/lib/notifications/catalogue'

export const dynamic = 'force-dynamic'

const EXAMPLE_LOCKS: Record<string, Partial<Rule>> = {
  'step-assigned': { fixEnabled: true },
  'team-order-changed': { fixTiming: true },
}

export default async function NotificationSettingsCheck({ searchParams }: { searchParams: Promise<{ level?: string; tab?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { level = 'admin', tab } = await searchParams
  const isAdmin = level === 'admin'
  const who = { isAdmin, leads: level === 'lead', canTool: (k: string) => isAdmin || ['publishing', 'i7-budget'].includes(k) }
  const mine = NOTIFICATION_TYPES.filter(t => !t.available || reaches(t, who)).map(t => t.key)
  const rules = Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, { ...defaultRule(t), ...EXAMPLE_LOCKS[t.key] }]))
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1080px] mx-auto space-y-5">
        <div>
          <Breadcrumb now="Notification settings" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Notification settings</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">What notifies you, when, and where. Every notification the portal has, including the ones still to come.</p>
        </div>
        <NotificationSettings
          types={NOTIFICATION_TYPES} mine={mine} rules={rules} prefs={{}} isAdmin={isAdmin}
          savePref={null} saveRule={null} initialTab={tab === 'rules' ? 'rules' : 'mine'}
        />
      </div>
    </div>
  )
}
