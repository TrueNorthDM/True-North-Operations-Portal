// Topic Studio settings (phase 4, 6 November 2026): the Claude features (on or
// off, model, effort), the limits per person, the models that may not be used,
// the prompts, and the usage log. Super Admins only for now; the owner decides
// who else may edit the rules (plan task p4-grant).

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { requireSurface } from '@/lib/access/resolve'
import { ROUTES } from '@/lib/nav/routes'
import { createAdminClient } from '@/lib/supabase/admin'
import { claudeConfigured } from '@/lib/topic-studio/ai/claude'
import { loadSettings, recentUsage } from '@/lib/topic-studio/ai/store'
import { listClientsFull } from '@/lib/topic-studio/store'
import { PAGE_TITLE } from '@/lib/ui/type'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Topic Studio settings' }

export default async function TopicStudioSettings() {
  const access = await requireSurface('tools')
  if (!access.isSuperAdmin) notFound()
  const db = createAdminClient()
  const [settings, usage, clients] = await Promise.all([loadSettings(db), recentUsage(db, 100), listClientsFull(db)])
  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb self={`${ROUTES.topicStudio}/settings`} />
        <h1 className={PAGE_TITLE}>Topic Studio settings</h1>
      </div>
      <SettingsForm settings={settings} clients={clients} connected={claudeConfigured()} usage={usage} />
    </div>
  )
}
