'use client'

// The Columns menus (owner, 25 October 2026) on the real screens, with the
// sample people of Timesheet Periods.dc.html: Rates & Costs, and the Directory
// with its People, Emails, Access log and Portal access tabs. A choice "saves"
// a moment later without the server, or fails and goes back (?fail=1).
// Development only.

import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import type { AccessLogEntry } from '@/components/admin/AccessLogManager'
import { teamKeyFromName, type CardRights, type PersonView } from '@/lib/directory/people-types'
import type { HiddenColumns, SaveHidden, TableId } from '@/lib/settings/columns'
import { idOf, SEED, TEAMS } from '../clocky-periods/sample'
import { RatesPayCheck } from '../clocky-part2/RatesPayCheck'

const later = <T,>(v: T): Promise<T> => new Promise(done => setTimeout(() => done(v), 400))
const SAVES: SaveHidden = () => later({ ok: true })
const FAILS: SaveHidden = () => later({ ok: false, error: 'Columns not saved. Try again in a moment.' })

const RIGHTS: CardRights = { rates: true, accessLog: true, portal: true, invite: true, resetTwoStep: true, edit: true, positions: true, work: true }

// Fixed times: Date.now() in render is impure (lint react-hooks/purity).
const AT = (d: string) => `2026-10-${d}T14:30:00Z`

function people(): PersonView[] {
  return SEED.map(([name, team, title, mgr, joined], i): PersonView => {
    const first = name.split(' ')[0].toLowerCase()
    return {
      id: idOf(name), full_name: name, avatarUrl: null, title,
      teamId: team || null, teamName: team || null, teamKey: teamKeyFromName(team), color: TEAMS[team] ?? '#64748b', teams: [],
      manager_id: mgr ? idOf(mgr) : null, managerName: mgr || null, alsoReportsToId: null, alsoReportsToName: null,
      employmentType: i % 3 === 0 ? 'us' : 'contractor', schedule: i % 4 === 0 ? 'part' : 'full', weeklyHours: null, hireDate: joined,
      roleType: name === 'Dave Sharpe' ? 'super_admin' : title.includes('Leader') ? 'team_leader' : 'user',
      status: name === 'Olivia Hale' ? 'inactive' : 'active',
      emails: { trueNorth: `${first}@truenorthdigitalmarketing.com`, goodnews: i % 5 === 4 ? null : `${first}@goodnewsadvocates.org`, coe: i % 2 ? `${first}@coe.org` : null },
      accountId: i % 3 === 2 ? null : `acc-${i}`, accountEmail: null, hasTsheets: i % 4 !== 3,
      lastAccessAt: i % 3 === 2 ? null : AT(String(10 + i).padStart(2, '0')), portalInvitedAt: i % 3 === 2 ? null : AT('01'),
      twoStepSince: i % 2 ? AT('02') : null,
    }
  })
}

function accessLog(list: PersonView[]): AccessLogEntry[] {
  return list.filter(p => p.accountId).map((p, i) => ({
    id: `al-${i}`, personId: p.id, name: p.full_name, email: p.emails.goodnews ?? p.emails.trueNorth ?? '',
    userAgent: i % 2 ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36',
    accessedAt: p.lastAccessAt ?? AT('20'), avatarUrl: null, teamKey: p.teamKey, color: p.color,
  }))
}

export function ColumnsCheck({ table, hidden, fail }: { table: 'rates' | 'directory'; hidden: Partial<Record<TableId, string[]>>; fail: boolean }) {
  const save = fail ? FAILS : SAVES
  if (table === 'rates') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-10">
        <RatesPayCheck editing={false} hidden={hidden.rates} saveColumns={save} />
      </div>
    )
  }
  const list = people()
  const initial: HiddenColumns = hidden
  return (
    <div className="min-h-screen bg-background p-4 md:p-10">
      <DirectoryTabs
        people={list}
        teamOptions={Object.entries(TEAMS).map(([name, color]) => ({ id: name, name, key: teamKeyFromName(name), color }))}
        teamCards={[]}
        rights={RIGHTS}
        accessLog={accessLog(list)}
        allowed={['emails', 'access', 'portal']}
        hiddenColumns={initial}
        saveColumns={save}
      />
    </div>
  )
}
