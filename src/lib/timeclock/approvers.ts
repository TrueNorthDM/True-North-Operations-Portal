/**
 * Who approves hours and time off (8 October 2026: the Super Admins, for now).
 *
 * One answer for the page (who a month "goes to") and for the actions (whether
 * a month can be sent at all). The database asks the same question in
 * tc_people_i_approve() (migration 096), so the button, the action and the row
 * rules cannot disagree.
 *
 * It used to be the person's manager and the team's leader_person_id, a column
 * nothing had kept current since team positions (Lead/Member) replaced it.
 *
 * Read with the service role: "who signs off for me" is not something the
 * caller should have to be allowed to ask.
 */

import type { Db } from '@/lib/supabase/types'

type Client = Db

export interface Approver { id: string; name: string }

/** The people who can approve this person's hours: every active Super Admin but themselves. */
export async function loadApprovers(db: Client, personId: string): Promise<Approver[]> {
  const { data, error } = await db.from('people')
    .select('id, full_name')
    .eq('access_level', 'super_admin')
    .eq('status', 'active')
    .order('full_name')
  if (error) throw new Error(`Approvers could not be read: ${error.message}`)
  return ((data ?? []) as { id: string; full_name: string }[])
    .filter(p => p.id !== personId)          // nobody approves their own hours
    .map(p => ({ id: p.id, name: p.full_name }))
}
