// The rail as the prototypes draw it on the home page (Clock Panel.dc.html,
// Who's Working.dc.html): Home lit, the rest 62% white, the avatar at the foot.

import { NavIcon } from '@/components/NavIcon'
import type { NavIconKey } from '@/lib/nav/nav-icons'

const RAIL: (NavIconKey | null)[] = ['home', 'my-work', 'chat', 'emails', null, 'tools', 'people', null, 'admin', 'clocky']

export function DemoRail() {
  return (
    <nav className="w-16 shrink-0 bg-tn-primary flex flex-col items-center gap-1.5 pt-3 pb-3">
      {RAIL.map((k, i) => k
        ? <span key={k} className={`w-11 h-11 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-white/[.14] text-[#ffffff]' : 'text-white/[.62]'}`}><NavIcon name={k} size={20} /></span>
        : <span key={`r${i}`} className="w-7 h-px bg-white/20 my-1.5" />)}
      <span className="mt-auto w-10 h-10 rounded-full bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] flex items-center justify-center">AO</span>
    </nav>
  )
}
