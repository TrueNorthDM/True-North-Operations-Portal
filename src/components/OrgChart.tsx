/**
 * OrgChart — read-only company org chart, auto-laid-out from the reporting
 * hierarchy (lib/org/data.ts) using the pure-CSS .org-tree (globals.css).
 * Server-rendered; no interactivity, no diagram library.
 */

import type { OrgPerson } from '@/lib/org/data'

function PersonCard({ p }: { p: OrgPerson }) {
  return (
    <div className="inline-block min-w-[150px] max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
      <div className="text-sm font-semibold text-slate-800 leading-tight">{p.name}</div>
      {p.title && <div className="mt-0.5 text-[11px] text-slate-500 leading-tight">{p.title}</div>}
      {p.teams.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {p.teams.map(t => (
            <span
              key={t.name}
              className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500"
              title={t.name}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color ?? '#cbd5e1' }} />
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function OrgNode({ node }: { node: OrgPerson }) {
  return (
    <li>
      <PersonCard p={node} />
      {node.children.length > 0 && (
        <ul>
          {node.children.map(c => <OrgNode key={c.id} node={c} />)}
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
    <div className="org-tree overflow-x-auto pb-2">
      <ul>
        {roots.map(r => <OrgNode key={r.id} node={r} />)}
      </ul>
    </div>
  )
}
