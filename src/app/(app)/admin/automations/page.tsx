// Admin: Automations, the source-of-truth list of every automated moving part
// (webhooks, cron jobs, background pings), each with its live health where we
// monitor it. Renders straight from the code registry (lib/automations/registry)
// so the list can't silently drift from what's actually deployed.

import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUTOMATIONS, type AutomationKind } from '@/lib/automations/registry'
import { latestHealth, HEALTH_LABEL, type HealthResult, type HealthStatus } from '@/lib/health/checks'
import { runChecksNow } from './actions'
import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'

export const dynamic = 'force-dynamic'

const KIND_STYLE: Record<AutomationKind, { label: string; cls: string }> = {
  webhook: { label: 'Webhook', cls: 'text-tn-teal bg-tn-teal-soft border-tn-teal/20' },
  cron: { label: 'Scheduled', cls: 'text-[#5a49c8] bg-[#efeafc] border-[#5a49c8]/20' },
  client: { label: 'On app load', cls: 'text-[#b45309] bg-amber-50 border-amber-300/40' },
  'server-action': { label: 'On action', cls: 'text-slate-600 bg-slate-100 border-slate-300/50' },
}

function StatusDot({ status }: { status: HealthStatus | 'unknown' }) {
  const c = status === 'ok' ? '#1f8a5b' : status === 'warn' ? '#d99409' : status === 'down' ? '#d7392f' : '#94a3b8'
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} aria-hidden="true" />
}

function statusText(h: HealthResult | undefined, monitored: boolean): { label: string; status: HealthStatus | 'unknown' } {
  if (!monitored) return { label: 'Not monitored', status: 'unknown' }
  if (!h) return { label: 'Not checked yet', status: 'unknown' }
  if (h.status === 'ok') return { label: 'Operational', status: 'ok' }
  if (h.status === 'warn') return { label: 'Warning', status: 'warn' }
  return { label: 'Down', status: 'down' }
}

function fmt(iso: string | undefined): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default async function AutomationsPage() {
  const access = await requireSurface('automations')

  const admin = createAdminClient()
  const health = await latestHealth(admin)
  const anyHealth = Object.keys(health).length > 0
  const lastChecked = Object.values(health).map(h => h.checked_at).sort().at(-1)

  // Every monitored signal, flattened: the rollup counts signals, not cards, so
  // an automation with two signals can be down on one and fine on the other.
  const monitored = AUTOMATIONS.flatMap(a => a.healthServices ?? []).map(k => health[k]).filter(Boolean)
  const downCount = monitored.filter(h => !h.ok && h.status === 'down').length
  const warnCount = monitored.filter(h => !h.ok && h.status === 'warn').length

  const overall: HealthStatus | 'unknown' = !anyHealth ? 'unknown' : downCount > 0 ? 'down' : warnCount > 0 ? 'warn' : 'ok'
  const overallText = !anyHealth ? 'No checks recorded yet' : downCount > 0 ? `${downCount} integration${downCount > 1 ? 's' : ''} down` : warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''}` : 'All integrations operational'

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin'))]} now="Automations" />
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Automations</h1>
        <p className="mt-1.5 text-muted max-w-[760px]">
          Every automated moving part in the portal, and whether it is working. This list is the source of truth: it is defined in code and updated whenever an automation is added or changed.
        </p>
      </div>

      {/* Overall status + run-now */}
      <div className="flex items-center justify-between gap-4 flex-wrap rounded-[16px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="flex items-center gap-3">
          <StatusDot status={overall} />
          <div>
            <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{overallText}</div>
            <div className="text-[12.5px] text-muted">Last checked: {fmt(lastChecked)}</div>
          </div>
        </div>
        <form action={runChecksNow}>
          <button type="submit" className="inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-4 py-2.5 shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 hover:-translate-y-px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
            <span className="text-[#ffffff]">Run checks now</span>
          </button>
        </form>
      </div>

      {!anyHealth && (
        <div className="rounded-[14px] border border-amber-300/50 bg-amber-50 px-4 py-3 text-[13px] text-[#7a4e05]">
          No health checks have been recorded yet. If you just added this feature, run migration <code className="font-mono">046_system_health.sql</code> in Supabase, then click <b>Run checks now</b>.
        </div>
      )}

      {/* Automation cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {AUTOMATIONS.map(a => {
          const keys = a.healthServices ?? []
          const monitoredFlag = keys.length > 0
          const signals = keys.map(k => health[k]).filter(Boolean)
          // The card's dot shows the worst of its signals, so a green webhook
          // registration can't mask an unverified signature next to it.
          const h = signals.find(s => !s.ok && s.status === 'down') ?? signals.find(s => !s.ok) ?? signals[0]
          const st = statusText(h, monitoredFlag)
          const kind = KIND_STYLE[a.kind]
          return (
            <div key={a.id} className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-(family-name:--font-display) font-extrabold text-[15.5px] text-tn-ink">{a.name}</h2>
                  <span className={`inline-block mt-1.5 font-(family-name:--font-display) font-bold text-[10.5px] tracking-wide uppercase border rounded-full px-2 py-0.5 ${kind.cls}`}>{kind.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-slate-200 bg-subtle px-2.5 py-1">
                  <StatusDot status={st.status} />
                  <span className="text-[12px] font-semibold text-foreground whitespace-nowrap">{st.label}</span>
                </div>
              </div>

              <p className="mt-3 text-[13px] text-foreground leading-relaxed">{a.purpose}</p>

              <dl className="mt-4 space-y-1.5 text-[12.5px]">
                <div className="flex gap-2"><dt className="text-muted w-[74px] shrink-0">Trigger</dt><dd className="text-foreground">{a.trigger}</dd></div>
                {a.schedule && <div className="flex gap-2"><dt className="text-muted w-[74px] shrink-0">Schedule</dt><dd className="text-foreground">{a.schedule}</dd></div>}
                <div className="flex gap-2"><dt className="text-muted w-[74px] shrink-0">Code</dt><dd className="text-foreground font-mono text-[11.5px] break-all">{a.location}</dd></div>
                {a.since && <div className="flex gap-2"><dt className="text-muted w-[74px] shrink-0">Since</dt><dd className="text-foreground">{a.since}</dd></div>}
                {monitoredFlag && (
                  <div className="flex gap-2">
                    <dt className="text-muted w-[74px] shrink-0">Health</dt>
                    <dd className="text-foreground space-y-0.5">
                      {keys.map(k => {
                        const s = health[k]
                        return <div key={k}>{HEALTH_LABEL[k] ?? k}{s?.detail ? `: ${s.detail}` : ''}{s?.checked_at ? ` (${fmt(s.checked_at)})` : ''}</div>
                      })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )
        })}
      </div>

      {/* All raw health signals (including ones not tied to a single card) */}
      {anyHealth && (
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink mb-3">Latest health signals</h2>
          <div className="rounded-[16px] border border-slate-200 bg-white overflow-hidden">
            {Object.values(health).sort((a, b) => a.service.localeCompare(b.service)).map((h, i) => (
              <div key={h.service} className={`flex items-center gap-3 px-5 py-3 ${i === 0 ? '' : 'border-t border-slate-100'}`}>
                <StatusDot status={h.status} />
                <span className="font-semibold text-[13px] text-tn-ink w-[180px] shrink-0">{HEALTH_LABEL[h.service] ?? h.service}</span>
                <span className="text-[12.5px] text-foreground flex-1 min-w-0">{h.detail}</span>
                <span className="text-[11.5px] text-muted whitespace-nowrap">{fmt(h.checked_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
