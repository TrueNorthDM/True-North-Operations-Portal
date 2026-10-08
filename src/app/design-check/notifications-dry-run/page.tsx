// Design check: what the notifications would send right now, from the live
// data, without writing anything (dry run). The work notifications look at
// "assigned" events from the last ?hours= (4 by default), as one sync would.
// ?as=<first name> opens the bell as that person would see it once everything
// planned has landed. Development only.

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAudience } from '@/lib/notifications/audience'
import { notifyAfterSync } from '@/lib/notifications/run'
import { TYPE_BY_KEY } from '@/lib/notifications/catalogue'
import { toItems } from '@/lib/notifications/inbox'
import { NotificationButton } from '@/components/NotificationButton'

export const dynamic = 'force-dynamic'

/** The clock, read outside render: this page runs once per request by design. */
const clock = () => Date.now()

export default async function DryRun({ searchParams }: { searchParams: Promise<{ hours?: string; as?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { hours = '4', as } = await searchParams
  const since = new Date(clock() - Number(hours) * 3_600_000).toISOString()
  const db = createAdminClient()
  const [aud, res] = await Promise.all([loadAudience(db), notifyAfterSync({ since, dryRun: true, db })])
  const name = (id: string) => aud.byId.get(id)?.name ?? id
  const rows = res.planned ?? []
  if (as) {
    const person = aud.people.find(p => p.name.toLowerCase().startsWith(as.toLowerCase()))
    const mine = rows
      .filter(r => r.person_id === person?.personId)
      .map((r, i) => ({ ...r, id: `dry-${i}`, read_at: null }))
      .sort((a, b) => b.deliver_at.localeCompare(a.deliver_at))
    // As if read the morning after, when the daily summary has landed.
    const morning = new Date(Math.max(...mine.map(r => Date.parse(r.deliver_at)), clock()))
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between h-[65px]">
          <span className="text-sm font-semibold text-slate-500">{`Dry run: the bell for ${person?.name ?? as}`}</span>
          <NotificationButton kind="bell" items={toItems(mine, morning)} startOpen />
        </header>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-background p-8 text-[13px]">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <h1 className="text-[22px] font-extrabold text-tn-ink">Notifications, dry run</h1>
        <p>People who can sign in: {aud.people.length} (admins {aud.admins().length}). Drafts: {res.drafts ?? 0}. Would send: {rows.length}.</p>
        <pre className="bg-white p-3 rounded border">{JSON.stringify({ byType: res.byType, failed: res.failed, skipped: res.skipped }, null, 2)}</pre>
        <table className="w-full bg-white border">
          <thead><tr className="text-left"><th className="p-2">To</th><th>Type</th><th>When</th><th>Title</th><th>Body</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.person_id}${r.type_key}${r.dedupe_key}`} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{name(r.person_id)}</td>
                <td className="whitespace-nowrap">{TYPE_BY_KEY.get(r.type_key)?.src}</td>
                <td className="whitespace-nowrap">{r.timing === 'instant' ? 'now' : r.deliver_at.slice(0, 16)}</td>
                <td>{r.title}</td>
                <td>{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
