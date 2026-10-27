// Company settings > North Time rollout > Clocked in TSheets after switching
// (owner, 27 October 2026): the TSheets entries dated on or after their
// person's North Time start date. The import keeps them aside, whole, instead
// of writing them as hours (lib/timeclock/waves.ts, splitByStart), so someone
// decides what each one was. Super Admins and Admins (cs-rollout); read only
// for now.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { createAdminClient } from '@/lib/supabase/admin'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadSkippedEntries } from '@/lib/timeclock/waves-data'
import { dateLabel, timeLabel, zoneAbbr } from '@/lib/timeclock/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clocked in TSheets after switching' }

const hours = (s: number) => { const m = Math.round(s / 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` }
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'

export default async function TsheetsAfterSwitchPage() {
  const access = await requireSurface('settings')
  if (!access.can('cs-rollout')) redirect(await previewHref('/admin/settings'))
  const [entries, viewer] = await Promise.all([loadSkippedEntries(createAdminClient()), viewerFor(access)])
  const zone = viewer?.zone ?? 'America/New_York'
  const abbr = zoneAbbr(zone, new Date())
  const total = entries.filter(e => !e.deletedInTsheets).reduce((s, e) => s + e.seconds, 0)

  return (
    <div className="space-y-[22px]">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin')), '/admin/settings']} now="Clocked in TSheets after switching" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Clocked in TSheets after switching</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-normal">
          TSheets entries dated on or after their person&apos;s North Time start date. The import did not write them as hours: each one is kept here, whole, until someone decides what it was. Times in {abbr}.
        </p>
      </div>

      {entries.length === 0
        ? <p className="text-[14px] text-muted">Nothing here. When someone clocks in TSheets on or after their North Time start date, the entry shows here.</p>
        : (
          <div className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden">
            <div className="px-[18px] py-3.5 border-b border-[var(--panel-border)] text-[13px] text-foreground">
              <b className="text-tn-ink">{entries.length}</b> {entries.length === 1 ? 'entry' : 'entries'}, <b className="text-tn-ink tabular-nums lining-nums">{hours(total)}</b> still in TSheets.
            </div>
            <div className={`hidden lg:grid grid-cols-[minmax(0,1fr)_110px_120px_80px_minmax(0,1.6fr)] bg-subtle border-b border-[var(--panel-border)] ${LABEL}`}>
              <div className="px-[18px] py-[9px]">Person</div><div className="px-3 py-[9px]">Day</div><div className="px-3 py-[9px]">Time</div><div className="px-3 py-[9px]">Hours</div><div className="px-3 py-[9px]">Job, fields and notes</div>
            </div>
            {entries.map(e => (
              <div key={e.externalId} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_110px_120px_80px_minmax(0,1.6fr)] border-b border-[var(--row-rule)] text-[13px] max-lg:px-[18px] max-lg:py-3 max-lg:gap-1" style={{ opacity: e.deletedInTsheets ? 0.55 : 1 }}>
                <div className="lg:px-[18px] lg:py-2.5 flex flex-col gap-0.5">
                  <span className="text-tn-ink font-bold">{e.name}</span>
                  <span className="text-[12px] text-muted">Started on North Time {dateLabel(e.startsOn)}</span>
                </div>
                <div className="lg:px-3 lg:py-2.5 tabular-nums lining-nums">{dateLabel(e.date)}</div>
                <div className="lg:px-3 lg:py-2.5 tabular-nums lining-nums">{e.startedAt ? `${timeLabel(e.startedAt, zone)} to ${e.endedAt ? timeLabel(e.endedAt, zone) : 'now'}` : e.kind === 'manual' ? 'Added by hand' : '-'}</div>
                <div className="lg:px-3 lg:py-2.5 tabular-nums lining-nums font-bold text-tn-ink">{hours(e.seconds)}</div>
                <div className="lg:px-3 lg:py-2.5 flex flex-col gap-0.5 min-w-0">
                  <span className="text-tn-ink break-words">{e.jobPath ?? 'Job not in the catalogue'}</span>
                  {e.fields.length > 0 && <span className="text-[12px] text-foreground break-words">{e.fields.map(f => `${f.label}: ${f.value}`).join(' · ')}</span>}
                  {e.notes && <span className="text-[12px] text-muted break-words">{e.notes}</span>}
                  <span className="text-[12px] text-muted">
                    TSheets #{e.externalId}
                    {e.alreadyInEntries ? ' · also in Time entries (imported before the date was set)' : ''}
                    {e.deletedInTsheets ? ' · deleted in TSheets since' : ''}
                    {e.decision ? ` · ${e.decision}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
