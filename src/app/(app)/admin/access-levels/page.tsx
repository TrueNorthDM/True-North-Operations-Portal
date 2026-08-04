// Admin → Access levels: the reference for what each contact type
// (people.role_type) can see and do, plus who currently holds each level, with
// inline reassignment. Replaces the cramped legend that used to live on the
// Directory's Teams tab.
//
// Admin-guarded server-side; the level picker calls setPersonRoleType, which
// re-checks admin on the server.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSecurityAdmin } from '@/lib/auth/role'
import { asRoleType } from '@/lib/auth/tier'
import { AccessLevelsBoard, type AccessPerson } from '@/components/admin/AccessLevelsBoard'

export const dynamic = 'force-dynamic'

export default async function AccessLevelsPage() {
  if (!(await isSecurityAdmin())) redirect('/')

  const supabase = await createClient()
  const [{ data }, { data: profileRows }] = await Promise.all([
    supabase
      .from('people')
      .select('id, full_name, title, avatar_url, role_type, profile_id, status, tsheets_only, email_true_north, email_goodnews, email_coe, email_personal')
      .eq('status', 'active')
      .order('full_name'),
    supabase.from('profiles').select('id, email, role'),
  ])

  // The configured matrix. Absent rows fall back to the catalogue defaults,
  // resolved in the board so a new surface needs no backfill.
  const { data: surfaceRows } = await supabase.from('access_level_pages').select('role_type, surface_key, allowed')
  const configured: Record<string, boolean> = {}
  for (const r of surfaceRows ?? []) configured[`${r.role_type}:${r.surface_key}`] = r.allowed

  // Whether someone has actually signed in. people.profile_id is only set when
  // an admin links the account by hand, so most rows have it null even for
  // people who log in daily; matching any of their addresses against profiles
  // catches those too (same resolution the Directory's access log uses).
  const roleByProfileId = new Map((profileRows ?? []).map(p => [p.id, p.role ?? null]))
  const profileByEmail = new Map(
    (profileRows ?? [])
      .map(p => [(p.email ?? '').trim().toLowerCase(), p] as const)
      .filter(([e]) => e),
  )

  // Only real portal contacts: TSheets-only rows exist to attribute hours and
  // never sign in, so listing them here would just be noise.
  const people: AccessPerson[] = (data ?? [])
    .filter(p => !p.tsheets_only)
    .map(p => {
      const emails = [p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal]
        .map(e => (e ?? '').trim().toLowerCase())
        .filter(Boolean)
      // The account behind this person: the explicit link if it resolves, else
      // a mailbox that matches a profile.
      const linkedId = p.profile_id && roleByProfileId.has(p.profile_id) ? p.profile_id : null
      const matched = linkedId ?? emails.map(e => profileByEmail.get(e)?.id).find(Boolean) ?? null

      return {
        id: p.id,
        name: p.full_name,
        title: p.title,
        avatarUrl: p.avatar_url,
        roleType: asRoleType(p.role_type),
        hasAccount: Boolean(matched),
        // The hard gate (profiles.role) as it stands right now. Surfaced so an
        // account whose security role drifted from its level is visible instead
        // of silently half-privileged, the exact failure this page had.
        securityRole: matched ? (roleByProfileId.get(matched) ?? null) : null,
      }
    })

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-2">
          <Link href="/" className="font-semibold hover:text-tn-ink transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <Link href="/admin" className="font-semibold hover:text-tn-ink transition-colors">Admin</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-tn-ink">Access levels</span>
        </div>
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Access levels</h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          The four access levels, what each one can reach, and who has it today.
          Anyone with a <strong className="font-semibold text-tn-ink">@goodnewsadvocates.org</strong> or{' '}
          <strong className="font-semibold text-tn-ink">@truenorthdigitalmarketing.com</strong> address can sign in on their own,
          and starts as a <strong className="font-semibold text-tn-ink">User</strong>. Set their level here afterwards.
        </p>
        <div className="mt-3 flex items-center gap-2.5 flex-wrap">
          <Link
            href="/admin/view-stage"
            className="inline-flex items-center gap-2 rounded-full px-[17px] py-2.5 font-(family-name:--font-display) font-extrabold text-[12.5px] border bg-tn-primary border-tn-primary text-white shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-px"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="9.5" y="4" width="5" height="16" rx="1" /><rect x="16" y="4" width="5" height="16" rx="1" /></svg>
            Preview each level
          </Link>
          <Link href="/directory" className="text-[12.5px] font-(family-name:--font-display) font-extrabold text-muted hover:text-tn-teal transition-colors">
            Open the Directory →
          </Link>
        </div>
      </div>

      <AccessLevelsBoard people={people} configured={configured} />
    </div>
  )
}
