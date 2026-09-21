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

import { requireSurface } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { dateInZone, weekBounds } from '@/lib/timeclock/clock'
import { periodFor, type SubmissionState } from '@/lib/timeclock/periods'
import { workingDays } from '@/lib/timeclock/absence'
import { isSecurityAdmin } from '@/lib/auth/role'
import { HoursClient } from './HoursClient'
import type { TcEntryRow } from '@/lib/types/database.types'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getCurrentPerson } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Hours' }

export interface Jobcode { id: number; label: string; kind: string }
export interface Field { id: number; name: string; required: boolean; options: string[] }
/** Somebody else's month, waiting on me. */
export interface Waiting {
  personId: string
  name: string
  month: string
  state: SubmissionState
  seconds: number
  entries: number
  submittedAt: string | null
  note: string
}

/** A request for time off, mine or one waiting on me. */
export interface Absence {
  id: number
  personId: string
  personName: string
  jobcodeId: number
  kindLabel: string
  startDate: string
  endDate: string
  hoursPerDay: number
  days: number
  state: 'pending' | 'approved' | 'denied' | 'cancelled'
  reason: string
  decisionNote: string
  mine: boolean
}

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
  const me = await getCurrentPerson()

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

  // ── The month, and where it stands ──────────────────────────────────────
  const period = periodFor(bounds.start)
  const { data: periodRow } = await supabase
    .from('tc_periods').select('id').eq('start_date', period.start).eq('end_date', period.end).maybeSingle()

  // Everyone's rows for this period that RLS lets through: mine, plus anyone I
  // sign for. One query, and the database decides which of the two each row is.
  const { data: subRows } = periodRow
    ? await supabase.from('tc_submissions').select('*').eq('period_id', (periodRow as { id: number }).id)
    : { data: [] }
  const subs = (subRows ?? []) as { person_id: string; state: SubmissionState; submitted_at: string | null; note: string | null }[]
  const mySubmission = subs.find(r => r.person_id === me.id) ?? null
  const others = subs.filter(r => r.person_id !== me.id)

  // The month's own totals, which is what the button is about, not the week's.
  const { data: monthRows } = await supabase
    .from('tc_entries').select('person_id, duration_seconds')
    .gte('entry_date', period.start).lte('entry_date', period.end)
  const monthAll = (monthRows ?? []) as { person_id: string; duration_seconds: number }[]
  const mineThisMonth = monthAll.filter(r => r.person_id === me.id)

  const { data: nameRows } = others.length
    ? await supabase.from('people').select('id, full_name').in('id', others.map(o => o.person_id))
    : { data: [] }
  const nameById = new Map(((nameRows ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  const waiting: Waiting[] = others.map(o => {
    const theirs = monthAll.filter(r => r.person_id === o.person_id)
    return {
      personId: o.person_id,
      name: nameById.get(o.person_id) ?? 'Someone',
      month: period.month,
      state: o.state,
      seconds: theirs.reduce((s, r) => s + r.duration_seconds, 0),
      entries: theirs.length,
      submittedAt: o.submitted_at,
      note: o.note ?? '',
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  // Who would receive this month, named on the button. A person should know
  // where their timesheet is going before they send it, and if the answer is
  // nowhere they should find that out now rather than after.
  const [{ data: meRow }, { data: myTeams }] = await Promise.all([
    supabase.from('people').select('manager_id').eq('id', me.id).maybeSingle(),
    supabase.from('team_members').select('team_id').eq('person_id', me.id),
  ])
  const teamIds = ((myTeams ?? []) as { team_id: string }[]).map(t => t.team_id)
  const { data: leaderRows } = teamIds.length
    ? await supabase.from('teams').select('leader_person_id').in('id', teamIds)
    : { data: [] }
  const approverIds = new Set<string>()
  const mgr = (meRow as { manager_id: string | null } | null)?.manager_id
  if (mgr) approverIds.add(mgr)
  for (const t of (leaderRows ?? []) as { leader_person_id: string | null }[]) {
    if (t.leader_person_id) approverIds.add(t.leader_person_id)
  }
  approverIds.delete(me.id)
  const { data: approverRows } = approverIds.size
    ? await supabase.from('people').select('id, full_name').in('id', [...approverIds])
    : { data: [] }
  const approvers = ((approverRows ?? []) as { id: string; full_name: string }[]).map(p => p.full_name)

  const isAdmin = await isSecurityAdmin()

  // ── Time off ────────────────────────────────────────────────────────────
  // RLS returns mine and anyone I sign for in one query, the same shape as the
  // submissions above.
  const { data: absRows } = await supabase
    .from('tc_absence_requests').select('*')
    .order('start_date', { ascending: false }).limit(60)
  const absences = (absRows ?? []) as {
    id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string
    hours_per_day: number; state: Absence['state']; reason: string | null; decision_note: string | null
  }[]

  const absentIds = [...new Set(absences.map(a => a.person_id))].filter(id => id !== me.id)
  const { data: absNames } = absentIds.length
    ? await supabase.from('people').select('id, full_name').in('id', absentIds)
    : { data: [] }
  const absNameById = new Map(((absNames ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  // Only the kinds somebody may still pick. The deactivated ones stay readable
  // on old entries, as everywhere else in this module.
  const { data: ptoRows } = await supabase
    .from('tc_jobcodes').select('id, name, kind').in('kind', ['pto', 'unpaid']).eq('active', true).order('name')
  const timeOffKinds = ((ptoRows ?? []) as { id: number; name: string; kind: string }[])
    .map(j => ({ id: j.id, label: j.kind === 'unpaid' ? `${j.name} (unpaid)` : j.name }))
  const kindById = new Map(timeOffKinds.map(k => [k.id, k.label]))

  const timeOff: Absence[] = absences.map(a => ({
    id: a.id,
    personId: a.person_id,
    personName: a.person_id === me.id ? 'You' : (absNameById.get(a.person_id) ?? 'Someone'),
    jobcodeId: a.jobcode_id,
    kindLabel: kindById.get(a.jobcode_id) ?? 'Time off',
    startDate: a.start_date,
    endDate: a.end_date,
    hoursPerDay: Number(a.hours_per_day),
    days: workingDays(a.start_date, a.end_date).length,
    state: a.state,
    reason: a.reason ?? '',
    decisionNote: a.decision_note ?? '',
    mine: a.person_id === me.id,
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
        <Breadcrumb self="/hours" />
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
        month={period.month}
        monthSeconds={mineThisMonth.reduce((s, r) => s + r.duration_seconds, 0)}
        submissionState={mySubmission?.state ?? null}
        submissionNote={mySubmission?.note ?? ''}
        waiting={waiting}
        approvers={approvers}
        isAdmin={isAdmin}
        myPersonId={me.id}
        timeOff={timeOff}
        timeOffKinds={timeOffKinds}
        running={running && {
          id: running.id,
          startedAt: running.started_at!,
          jobcodeId: running.jobcode_id,
        }}
      />
    </div>
  )
}
