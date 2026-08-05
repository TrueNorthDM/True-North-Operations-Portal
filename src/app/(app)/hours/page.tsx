// My Hours, a person's own clock. The module around it is Clocky.
//
// Phase 2: people can track time here, in parallel with QuickBooks Time, which
// is still the system of record. Nothing on this page writes anywhere else.
//
// Scoped to the signed-in person twice over, and both are needed. Migration
// 058's policy is the floor nobody can get under. The explicit person_id filter
// below is what the page MEANS: policies combine with OR, so an admin's blanket
// policy from 057 also satisfies the read, and without the filter this page
// showed the whole company's week under the title "My Time".

import Link from 'next/link'
import { requireSurface } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { dateInZone, weekBounds } from '@/lib/timeclock/clock'
import { HoursClient } from './HoursClient'
import type { TcEntryRow } from '@/lib/types/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Hours' }

export interface Jobcode { id: number; label: string; kind: string }
export interface Field { id: number; name: string; required: boolean; options: string[] }
export interface Entry {
  id: number
  entryDate: string
  jobcodeId: number | null
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number
  kind: string
  state: string
  notes: string
  fields: Record<string, string>
  editable: boolean
}

export default async function MyHoursPage({
  searchParams,
}: { searchParams: Promise<{ week?: string }> }) {
  await requireSurface('my-hours')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, user)

  if (!me) {
    return (
      <div className="rounded-[12px] border border-amber-300/60 bg-amber-50 p-5 text-sm text-[#8a6d1a]">
        Your login is not linked to anybody in the directory yet, so there is nowhere to put your hours.
        Ask an admin to link your account on the Directory.
      </div>
    )
  }

  const { data: settingsRow } = await supabase
    .from('tc_settings').select('timezone, week_start').eq('singleton_id', 1).maybeSingle()
  const timezone = settingsRow?.timezone ?? 'America/New_York'
  const weekStart = settingsRow?.week_start ?? 0

  const { week } = await searchParams
  const today = dateInZone(new Date(), timezone)
  const bounds = weekBounds(/^\d{4}-\d{2}-\d{2}$/.test(week ?? '') ? week! : today, weekStart)

  // Only what someone may pick TODAY. The other 519 job codes are history and
  // stay readable everywhere else, but offering them here would be offering to
  // log time against a client that ended in 2019.
  const [{ data: jobcodeRows }, { data: fieldRows }, { data: optionRows }, { data: entryRows }] =
    await Promise.all([
      supabase.from('tc_jobcodes').select('id, name, kind, parent_id, active').eq('active', true).order('name'),
      supabase.from('tc_fields').select('id, name, required, position, active').eq('active', true).order('position'),
      supabase.from('tc_field_options').select('id, field_id, label, active').eq('active', true).order('label'),
      // Scoped to me explicitly, and not left to RLS. Policies combine with OR,
      // so an admin's blanket policy from 057 satisfies the read as well and
      // this page would quietly show the whole company's week. "My Time" means
      // mine by definition, not "everything I happen to be allowed to see".
      supabase.from('tc_entries').select('*')
        .eq('person_id', me.id)
        .gte('entry_date', bounds.start).lte('entry_date', bounds.end)
        .order('entry_date').order('started_at', { nullsFirst: false }),
    ])

  const parents = new Map((jobcodeRows ?? []).map(j => [j.id, j.name]))
  const jobcodes: Jobcode[] = (jobcodeRows ?? []).map(j => ({
    id: j.id,
    // The tree is two deep and the leaf names repeat ("Content" sits under both
    // True North and i7 Marketing), so a bare leaf name is ambiguous in a list.
    label: j.parent_id && parents.has(j.parent_id) ? `${parents.get(j.parent_id)} · ${j.name}` : j.name,
    kind: j.kind,
  })).sort((a, b) => a.label.localeCompare(b.label))

  const fields: Field[] = (fieldRows ?? []).map(f => ({
    id: f.id,
    name: f.name,
    required: f.required,
    options: (optionRows ?? []).filter(o => o.field_id === f.id).map(o => o.label),
  }))

  const rows = (entryRows ?? []) as TcEntryRow[]
  const entries: Entry[] = rows.map(r => ({
    id: r.id,
    entryDate: r.entry_date,
    jobcodeId: r.jobcode_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds,
    kind: r.kind,
    state: r.state,
    notes: r.notes ?? '',
    fields: r.fields ?? {},
    // Imported hours are QuickBooks Time's, and anything already submitted is a
    // claim somebody acted on. Both are read-only here, and the policies say so
    // too, so the buttons match what the database would actually allow.
    editable: r.state === 'open' && r.source === 'portal',
  }))

  const running = rows.find(r => r.ended_at === null && r.kind === 'clock') ?? null

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground font-semibold">My Hours</span>
        </div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">My Hours</h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          Track your hours here. QuickBooks Time is still the official record for now,
          so keep logging there until we say otherwise.
        </p>
      </div>

      <HoursClient
        timezone={timezone}
        today={today}
        weekStartDate={bounds.start}
        weekEndDate={bounds.end}
        jobcodes={jobcodes}
        fields={fields}
        entries={entries}
        running={running && {
          id: running.id,
          startedAt: running.started_at!,
          jobcodeId: running.jobcode_id,
        }}
      />
    </div>
  )
}
