// My profile, the signed-in user's own directory card (read-only). Opened from
// the avatar menu. Any authenticated user can see their own record; editing
// stays in the admin Directory. Deliberately omits internal cost rate.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTier } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import {
  TEAM_COLOR, initialsOf, formatDate, teamKeyFromName,
  typePill, timePill, ynPill, statusPill, roleTypePill, lifecyclePill,
} from '@/lib/directory/people-types'
// Shared with the popup on My Team, so the two render the same card.
import { Badge, Row, Section, ManagedNote, txt, mail } from '@/components/profile/profile-parts'
import type { PersonRow } from '@/lib/types/database.types'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { PersonalDetails } from '@/components/PersonalDetails'

export const dynamic = 'force-dynamic'

// The subset PROFILE_COLS fetches. (A concatenated select string isn't a literal,
// so the client can't infer the row shape, we cast to this.)
type MeRow = Pick<PersonRow,
  'id' | 'full_name' | 'last_name' | 'title' | 'manager_id' | 'also_reports_to_id' | 'reports_to_manager'
  | 'manager_name_text' | 'employment_type' | 'schedule' | 'weekly_hours' | 'status' | 'role_type' | 'phone'
  | 'location' | 'whatsapp_same_number' | 'date_of_birth'
  | 'hire_date' | 'left_on' | 'email_true_north' | 'email_goodnews' | 'email_coe' | 'email_personal'
  | 'employment_history' | 'monday_docs'>

const PROFILE_COLS =
  'id, full_name, last_name, title, manager_id, also_reports_to_id, reports_to_manager, manager_name_text, ' +
  'employment_type, schedule, weekly_hours, status, role_type, phone, location, whatsapp_same_number, ' +
  'date_of_birth, hire_date, left_on, ' +
  'email_true_north, email_goodnews, email_coe, email_personal, employment_history, monday_docs'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Who "me" is comes from loadCurrentPerson, the one resolver that honours a
  // View Stage preview. Resolving it here from user.id instead meant a preview
  // of another level rendered the real admin's own card.
  const current = await loadCurrentPerson(supabase, user)
  const { data: row } = current
    ? await supabase.from('people').select(PROFILE_COLS).eq('id', current.id).maybeSingle()
    : { data: null }
  const me = row as unknown as MeRow | null

  if (!me) {
    return (
      <div className="max-w-[560px] mx-auto mt-4">
        <div className="rounded-[16px] border border-slate-200 bg-white p-8 text-center">
          <h1 className="font-(family-name:--font-display) font-extrabold text-[20px] text-tn-ink m-0">My profile</h1>
          <p className="text-[14px] text-muted mt-2">
            You’re signed in as <b className="text-tn-ink">{user.email}</b>, but this account isn’t linked to a directory record yet.
          </p>
          <p className="text-[13px] text-muted mt-1">An admin can link it from the Directory.</p>
        </div>
      </div>
    )
  }

  const { isPrivileged } = await getCurrentTier()

  // Resolve related records for a complete card.
  const relIds = [me.manager_id, me.also_reports_to_id].filter(Boolean) as string[]
  const [relRes, tmRes, reportsRes, attRes] = await Promise.all([
    relIds.length ? supabase.from('people').select('id, full_name').in('id', relIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase.from('team_members').select('team_id').eq('person_id', me.id),
    supabase.from('people').select('id, full_name, title').eq('manager_id', me.id),
    supabase.from('person_attachments').select('id, file_name').eq('person_id', me.id),
  ])
  const nameById = new Map((relRes.data ?? []).map(r => [r.id, r.full_name]))
  const teamIds = (tmRes.data ?? []).map(r => r.team_id)
  const { data: teamRows } = teamIds.length ? await supabase.from('teams').select('id, name').in('id', teamIds) : { data: [] as { id: string; name: string }[] }
  const teamName = (teamRows ?? [])[0]?.name ?? null
  const teamKey = teamKeyFromName(teamName)
  const reports = reportsRes.data ?? []
  const attachments = attRes.data ?? []

  // Avatar fetched separately + gracefully (avatar_url is migration 036).
  const { data: avRow } = await supabase.from('people').select('avatar_url').eq('id', me.id).maybeSingle()
  const avatarUrl = (avRow as { avatar_url: string | null } | null)?.avatar_url ?? null

  // Onboarding / offboarding status fetched separately + gracefully (migration 043).
  const { data: lcRow } = await supabase.from('people').select('onboarding_status, offboarding_status').eq('id', me.id).maybeSingle()
  const lifecycle = lcRow as { onboarding_status: string | null; offboarding_status: string | null } | null
  const onboardingStatus = lifecycle?.onboarding_status ?? null
  const offboardingStatus = lifecycle?.offboarding_status ?? null

  const active = me.status !== 'inactive'

  return (
    <div className="max-w-[920px] mx-auto space-y-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Link href="/" className="font-semibold hover:text-tn-ink">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-tn-ink">My profile</span>
      </div>

      <div className="rounded-[18px] border border-slate-200 bg-white overflow-hidden">
        {/* header, larger avatar */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 min-w-0">
            <ProfileAvatar name={me.full_name} avatarUrl={avatarUrl} color={TEAM_COLOR[teamKey]} size={120} />
            <div className="min-w-0">
              <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink leading-tight m-0">{me.full_name}</h1>
              <p className="text-[15px] text-muted mt-1 font-semibold">{me.title || '-'}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1" style={{ color: TEAM_COLOR[teamKey], background: `${TEAM_COLOR[teamKey]}1a` }}>{teamName ?? 'No team'}</span>
                <Badge pill={roleTypePill(me.role_type ?? 'user')} />
                <Badge pill={statusPill(active)} />
              </div>
            </div>
          </div>
          {isPrivileged && <Link href="/directory" className="shrink-0 inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink border border-slate-200 rounded-[10px] px-4 py-2.5 transition-all hover:border-tn-ink">Manage in People &amp; Teams →</Link>}
        </div>

        {/* Part 1, the person's own, editable details */}
        <div className="px-8 pt-6 pb-6 border-b border-slate-200">
          <PersonalDetails initial={{
            lastName: me.last_name ?? '',
            personalEmail: me.email_personal ?? '',
            phone: me.phone ?? '',
            whatsappSameNumber: me.whatsapp_same_number ?? '',
            location: me.location ?? '',
            dateOfBirth: me.date_of_birth ?? '',
          }} />
        </div>

        {/* Part 2, HR-managed, read-only for the user (future HR module) */}
        <div className="px-8 pt-6 pb-6">
          <ManagedNote own />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            <Section title="Employment">
              <Row label="Contact type"><Badge pill={roleTypePill(me.role_type ?? 'user')} /></Row>
              <Row label="Type"><Badge pill={typePill(me.employment_type)} /></Row>
              <Row label="Time"><Badge pill={timePill(me.schedule)} /></Row>
              <Row label="Weekly hours">{txt(me.weekly_hours != null ? `${me.weekly_hours} h / week` : null)}</Row>
              <Row label="Status"><Badge pill={statusPill(active)} /></Row>
            </Section>

            <Section title="Reporting">
              <Row label="Reports to">{txt(me.manager_id ? nameById.get(me.manager_id) : null)}</Row>
              <Row label="Do you report to a manager?"><Badge pill={ynPill(me.reports_to_manager)} /></Row>
              <Row label="Also reports to">{txt(me.also_reports_to_id ? nameById.get(me.also_reports_to_id) : null)}</Row>
              <Row label="Manager (as stated)">{txt(me.manager_name_text)}</Row>
            </Section>

            <Section title="Company emails">
              <Row label="True North">{mail(me.email_true_north)}</Row>
              <Row label="GoodNews">{mail(me.email_goodnews)}</Row>
              <Row label="COE">{mail(me.email_coe)}</Row>
            </Section>

            <Section title="Onboarding">
              <Row label="Status"><Badge pill={lifecyclePill(onboardingStatus)} /></Row>
            </Section>

            <Section title="Offboarding">
              <Row label="Status"><Badge pill={lifecyclePill(offboardingStatus)} /></Row>
            </Section>

            <Section title="Dates">
              <Row label="Joined on">{txt(formatDate(me.hire_date))}</Row>
              <Row label="Left on">{txt(formatDate(me.left_on))}</Row>
            </Section>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="px-8 pb-6">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">Team members ({reports.length})</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2.5">
              {reports.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[11px]" style={{ width: 30, height: 30, background: TEAM_COLOR[teamKey] }}>{initialsOf(m.full_name)}</span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold text-tn-ink truncate">{m.full_name}</span>
                    <span className="block text-xs text-muted truncate">{m.title ?? '-'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {me.employment_history && me.employment_history.trim() && (
          <div className="px-8 pb-6">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">Employment history</div>
            <p className="text-[13.5px] leading-relaxed text-foreground m-0">{me.employment_history}</p>
          </div>
        )}

        {me.monday_docs && me.monday_docs.trim() && (
          <div className="px-8 pb-6">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">Monday Docs</div>
            <div className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap rounded-[10px] border border-slate-200 bg-subtle p-4 max-h-[340px] overflow-y-auto">{me.monday_docs}</div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="px-8 pb-8">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">Documents</div>
            <div className="flex flex-col gap-2">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-3 border border-slate-200 rounded-[10px] px-3.5 py-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span className="text-[13.5px] font-semibold text-tn-ink truncate">{a.file_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
