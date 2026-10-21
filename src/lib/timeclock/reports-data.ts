/**
 * Reads Clocky > Reports (reports.ts) for one person.
 *
 *   all    Super Admins and Admins (ck-all): everyone; money for those who
 *          see it (Admins, Finance)
 *   team   a Team Leader (ck-team): the teams they lead, hours only, a
 *          Timesheet column instead of the invoice
 *   own    everyone else: themselves, with their own invoice
 */

import type { Access } from '@/lib/access/resolve'
import { teamColour } from '@/lib/directory/team-colour'
import { allRows, db, loadCatalog, loadClockySettings, loadDirectory } from './clocky-context'
import { localDate } from './format'
import { isFinance, loadInvoiceSettings, loadPayTerms, loadRoutes } from './pay-terms'
import { loadApprovedExtra } from './allowance-data'
import { loadSubmissions } from './clocky-store'
import { currentStep, type TimesheetState } from './routing'
import { holidaysBetween, offDays } from './time-off'
import { ALL, buildReport, chartMonths, periodOf, type ReportPerson, type ReportQuery, type ReportRow, type ReportView } from './reports'


export interface ReportPage {
  query: ReportQuery
  view: ReportView
  scope: 'all' | 'team' | 'own'
  scopeLine: string
  /** "clocky-report-october-2026" */
  file: string
  /** For the PDF: "October 2026 · All teams". */
  scopeText: string
  from: string
  to: string
  options: { teams: { value: string; label: string }[]; people: { value: string; label: string }[]; clients: { value: string; label: string }[] }
}

/** The client colours of the design (README_PART2, "Client colors"); spaces do not count. */
const CLIENT_COLOR: Record<string, string> = {
  '1 - True North': '#012358', '2 - i7 Marketing': '#1E7D7F', 'Adventist Messengers/HFA': '#F2C40A', GNA: '#1E9E6A', 'A.org Job': '#6D5EF5', DDI: '#F0A35E',
}
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
const colorOf = (client: string) => CLIENT_COLOR[squash(client)] ?? '#a3aebb'

export async function loadReport(access: Pick<Access, 'personId' | 'can' | 'isAdmin'>, query: ReportQuery, now = new Date()): Promise<ReportPage | null> {
  const me = access.personId
  if (!me) return null
  const c = db()
  const [dir, catalog, settings, inv] = await Promise.all([loadDirectory(), loadCatalog(), loadClockySettings(), loadInvoiceSettings()])
  const zone = dir.zoneOf(me)
  const today = localDate(now, zone)
  const custom = query.kind === 'custom' && query.from && query.to && query.from <= query.to ? { from: query.from, to: query.to } : null
  const period = periodOf(query.kind, today, settings.anchor, custom)

  const led = dir.led.get(me) ?? new Set<string>()
  const scope: ReportPage['scope'] = access.can('ck-all') ? 'all' : access.can('ck-team') && led.size ? 'team' : 'own'
  const money = scope === 'own' || (scope === 'all' && (access.isAdmin || isFinance(access, inv)))
  const pool = [...dir.people.values()].filter(p => scope === 'all' ? p.active : scope === 'team' ? p.teamIds.some(t => led.has(t)) : p.id === me)
  const ids = pool.map(p => p.id)

  const chartFrom = chartMonths(period.to)[0]
  const lo = chartFrom < period.from ? chartFrom : period.from
  const keys = catalog.keys
  const entries = ids.length ? await allRows<{ person_id: string; jobcode_id: number | null; entry_date: string; duration_seconds: number; fields: Record<string, string> | null; kind: string; ended_at: string | null }>(
    (a, b) => c.from('tc_entries').select('person_id, jobcode_id, entry_date, duration_seconds, fields, kind, ended_at')
      .in('person_id', ids).neq('kind', 'absence').not('ended_at', 'is', null).gte('entry_date', lo).lte('entry_date', period.to).order('id').range(a, b),
    'The hours could not be read') : []
  const clientOf = (jobId: number | null) => {
    const j = jobId != null ? catalog.jobs.get(jobId) : undefined
    if (!j) return 'No job'
    return j.folderId != null ? catalog.jobs.get(j.folderId)?.name ?? j.name : j.name
  }
  const rows: ReportRow[] = entries.map(e => ({
    personId: e.person_id, client: squash(clientOf(e.jobcode_id)), billable: !!keys.billable && (e.fields?.[keys.billable] ?? '').toLowerCase() === 'yes',
    seconds: Number(e.duration_seconds) || 0, date: e.entry_date,
  }))

  // Time off, invoices, allowances, timesheets.
  const [offRes, invRes, terms, extra, subs, routes] = await Promise.all([
    ids.length ? c.from('tc_absence_requests').select('person_id, start_date, end_date').in('person_id', ids).eq('state', 'approved').lte('start_date', period.to).gte('end_date', period.from) : { data: [], error: null },
    money && ids.length ? c.from('invoices').select('person_id, total, state').in('person_id', ids).neq('state', 'draft').gte('period_start', period.from).lte('period_start', period.to) : { data: [], error: null },
    loadPayTerms(ids),
    loadApprovedExtra(ids, period.from, period.to),
    scope === 'team' ? loadSubmissions(c, ids) : Promise.resolve(new Map()),
    scope === 'team' ? loadRoutes(ids) : Promise.resolve(new Map()),
  ])
  if (offRes.error) throw new Error(`Time off could not be read: ${offRes.error.message}`)
  if (invRes.error) throw new Error(`Invoices could not be read: ${invRes.error.message}`)
  const holidays = holidaysBetween(period.from, period.to)
  const ptoDays = (offRes.data ?? []).reduce((n, r) => n + offDays(r.start_date < period.from ? period.from : r.start_date, r.end_date > period.to ? period.to : r.end_date, holidays).days.length, 0)
  const invoiceOf = new Map<string, number>()
  for (const r of invRes.data ?? []) invoiceOf.set(r.person_id, (invoiceOf.get(r.person_id) ?? 0) + Number(r.total))

  const timesheetOf = (id: string): { text: string; approved: boolean } => {
    const mine = ((subs.get(id) ?? []) as { start: string; end: string; state: string }[]).filter(s => s.start <= period.to && s.end >= period.from).sort((a, b) => a.end.localeCompare(b.end)).at(-1)
    if (!mine) return { text: 'Not sent', approved: false }
    if (mine.state === 'approved' || mine.state === 'recorded') return { text: 'Approved', approved: true }
    if (mine.state === 'hours_approved') return { text: 'Hours approved', approved: true }
    if (mine.state === 'returned') return { text: 'Returned', approved: false }
    if (mine.state === 'submitted') {
      const route = routes.get(id)
      const owner = route ? currentStep(route, inv, mine.state as TimesheetState)?.owner ?? null : null
      return { text: !owner ? 'Sent' : owner === me ? 'Waiting for you' : `With ${dir.nameOf(owner)}`, approved: false }
    }
    return { text: 'Not sent', approved: false }
  }

  const people: ReportPerson[] = pool.map(p => {
    const t = p.teamId ? dir.teams.get(p.teamId) : undefined
    const term = terms.get(p.id)
    const ts = scope === 'team' ? timesheetOf(p.id) : null
    return {
      id: p.id, name: p.name, teamId: t?.id ?? null, teamName: t?.name ?? 'No team', teamColor: teamColour(t?.color, t?.name),
      contractor: !!term?.paysAs, allowance: term?.allowance ?? null, extraSeconds: extra(p.id, period.from, period.to) * 3600,
      invoice: money ? invoiceOf.get(p.id) ?? null : null, timesheet: ts?.text ?? null, timesheetApproved: !!ts?.approved,
    }
  })

  const view = buildReport({ kind: query.kind, from: period.from, to: period.to, label: period.label, rows, people, scope, money, ptoDays, clientColor: colorOf, clientOrder: Object.keys(CLIENT_COLOR), filters: { team: query.team, person: query.person, client: query.client, bill: query.bill } })
  const leadTeams = [...led].map(t => dir.teams.get(t)?.name).filter(Boolean).join(', ')
  const teamOpts = [...new Set(pool.map(p => p.teamId).filter((x): x is string => !!x))].map(t => ({ value: t, label: dir.teams.get(t)?.name ?? '' })).sort((a, b) => a.label.localeCompare(b.label))
  const slug = period.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return {
    query: { ...query, from: period.from, to: period.to }, view, scope, from: period.from, to: period.to,
    scopeLine: scope === 'own' ? 'Your own hours only.' : scope === 'team' ? `Your team only: ${leadTeams}. Hours only: invoices are not shown to Team Leaders.` : 'Everyone. Totals in multiples of 15 minutes.',
    file: `clocky-report-${slug}`,
    scopeText: [period.label, scope === 'own' ? dir.nameOf(me) : scope === 'team' ? `${leadTeams} team` : query.team === ALL ? 'All teams' : dir.teams.get(query.team)?.name ?? '',
      query.client !== ALL ? query.client : '', query.bill === 'yes' ? 'billable only' : query.bill === 'no' ? 'not billable only' : ''].filter(Boolean).join(' · '),
    options: {
      teams: [{ value: ALL, label: 'All teams' }, ...teamOpts],
      people: [{ value: ALL, label: 'Everyone' }, ...pool.filter(p => query.team === ALL || p.teamId === query.team).map(p => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label))],
      clients: [{ value: ALL, label: 'All clients' }, ...[...new Set(rows.map(r => r.client))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(cl => ({ value: cl, label: cl }))],
    },
  }
}
