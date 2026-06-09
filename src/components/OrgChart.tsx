/**
 * OrgChart — read-only company org chart as an indented vertical tree (like a
 * file tree), built from the reporting hierarchy (lib/org/data.ts). Grows
 * downward, barely sideways, so the whole structure fits in one view without
 * heavy horizontal scrolling. Server-rendered; no diagram library.
 */

import type { OrgPerson } from '@/lib/org/data'

function TeamChips({ teams }: { teams: OrgPerson['teams'] }) {
  if (teams.length === 0) return null
  return (
    <>
      {teams.map(t => (
        <span key={t.name} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400" title={t.name}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color ?? '#cbd5e1' }} />
          {t.name}
        </span>
      ))}
    </>
  )
}

function Node({ node }: { node: OrgPerson }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
        <span className="text-sm font-semibold text-slate-800">{node.name}</span>
        {node.title && <span className="text-xs text-slate-500">{node.title}</span>}
        <TeamChips teams={node.teams} />
      </div>
      {node.children.length > 0 && (
        <ul className="ml-2 border-l border-slate-200 pl-4">
          {node.children.map(c => <Node key={c.id} node={c} />)}
        </ul>
      )}
    </li>
  )
}

export function OrgChart({ roots }: { roots: OrgPerson[] }) {
  if (roots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-10 text-center text-sm text-slate-400">
        The org chart appears here once the People directory is set up.
      </div>
    )
  }
  return (
    <ul className="overflow-x-auto">
      {roots.map(r => <Node key={r.id} node={r} />)}
    </ul>
  )
}
