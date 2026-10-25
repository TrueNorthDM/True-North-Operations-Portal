// The type chips of Home's tabs card and its side panel (design_handoff_home,
// README "3. Needs you", the type chip table): one icon per kind, from the
// rail's set (nav-icons.ts), on its own ground. The rail has no alert
// triangle or plain clock, so those two paths are the prototype's.

import { NavIcon } from '@/components/NavIcon'
import type { NavIconKey } from '@/lib/nav/nav-icons'
import type { DueTone, HomeRow } from '@/lib/home/needs-you-model'

const ALERT = 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01'
const CLOCK = 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2'

export const DUE_FG: Record<DueTone, string> = { late: '#c8323d', today: '#012358', later: '#8593a4' }

type Look = { label: string; bg: string; fg: string; icon: NavIconKey | 'alert' | 'clock' }

const LOOK: Record<Exclude<HomeRow['kind'], 'mine'>, Look> = {
  approval: { label: 'Approval', bg: '#e8edf5', fg: '#012358', icon: 'tests' },
  request: { label: 'Request', bg: '#fbf1cf', fg: '#8a6703', icon: 'requests' },
  work: { label: 'My Work', bg: '#eaf4f4', fg: '#1E7D7F', icon: 'my-work' },
  system: { label: 'System', bg: '#fdecea', fg: '#b3271f', icon: 'alert' },
  access: { label: 'Access', bg: '#f1f3f6', fg: '#5b6b82', icon: 'admin' },
  invoices: { label: 'Invoices', bg: '#f1f3f6', fg: '#5b6b82', icon: 'client-reports' },
  // Finance's invoices and documents to pay (owner, 25 October 2026): the Invoices
  // kind's ground and icon, as the design has no colour of its own for money to pay.
  pay: { label: 'To pay', bg: '#f1f3f6', fg: '#5b6b82', icon: 'client-reports' },
}

export function typeOf(row: HomeRow): Look {
  if (row.kind !== 'mine') return LOOK[row.kind]
  const wait = row.mine?.state !== 'done'
  return { label: 'Request', bg: wait ? '#fdf8e7' : '#e6f6ee', fg: wait ? '#8a6d1a' : '#0d7a4f', icon: row.mine?.icon ?? 'requests' }
}

export function TypeChip({ row, size }: { row: HomeRow; size: 32 | 34 }) {
  const t = typeOf(row)
  const px = size === 34 ? 17 : 16
  return (
    <span title={t.label} className={`flex-none flex items-center justify-center ${size === 34 ? 'w-[34px] h-[34px] rounded-[10px]' : 'w-8 h-8 rounded-[9px]'}`} style={{ background: t.bg, color: t.fg }}>
      {t.icon === 'alert' || t.icon === 'clock'
        ? <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.icon === 'alert' ? ALERT : CLOCK} /></svg>
        : <NavIcon name={t.icon} size={px} strokeWidth={2} />}
    </span>
  )
}
