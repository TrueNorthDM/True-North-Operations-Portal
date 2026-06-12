'use client'

/**
 * OrgChart — read-only company org chart as a horizontal connector tree
 * (boxes), auto-laid-out from the reporting hierarchy. Each card carries its
 * team's signature color (top band) and the connector thread leading into it is
 * tinted the same color (via the --thread CSS var on each <li>; see globals.css
 * .org-tree). A full-screen toggle gives the wide chart room to breathe.
 */

import { useState } from 'react'
import type { OrgPerson, OrgTeamGroup } from '@/lib/org/data'

const NEUTRAL = '#cbd5e1'

function PersonCard({ p }: { p: OrgPerson }) {
  const color = p.color ?? NEUTRAL
  return (
    <div className="inline-block min-w-[148px] max-w-[210px] rounded-lg border border-slate-200 bg-white text-left shadow-sm overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="px-3 py-2">
        <div className="text-sm font-semibold text-slate-800 leading-tight">{p.name}</div>
        {p.title && <div className="mt-0.5 text-[11px] text-slate-500 leading-tight">{p.title}</div>}
        {p.teams.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.teams.map(t => (
              <span key={t.name} className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500" title={t.name}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color ?? NEUTRAL }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** A team rendered as a box: coloured header + members stacked vertically. */
function TeamBox({ team }: { team: OrgTeamGroup }) {
  const color = team.color ?? NEUTRAL
  const threadStyle = { ['--thread']: color } as React.CSSProperties
  return (
    <li style={threadStyle}>
      <div className="inline-block align-top min-w-[150px] max-w-[230px] rounded-lg border border-slate-200 bg-white text-left shadow-sm overflow-hidden">
        {/* Team band colours are fixed light pastels, so the header text is a
            fixed dark ink — not a themed token — to keep contrast in dark mode. */}
        <div className="px-3 py-2 text-sm font-bold text-[#26261f]" style={{ backgroundColor: color }}>{team.name}</div>
        {team.members.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-400">No members</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.members.map(m => <li key={m.id} className="px-3 py-1.5 text-xs text-slate-700">{m.name}</li>)}
          </ul>
        )}
      </div>
    </li>
  )
}

function Node({ node }: { node: OrgPerson }) {
  // The connector INTO this node is tinted by the node's own team color, so each
  // branch reads as a coloured thread down to its team. Colour-less nodes fall
  // back to the theme's connector token (light/dark aware).
  const threadStyle = { ['--thread']: node.color ?? 'var(--org-thread)' } as React.CSSProperties
  // Members of a team this person leads are shown INSIDE the team box, so they
  // shouldn't also appear as individual report nodes.
  const ledMemberIds = new Set(node.ledTeams.flatMap(t => t.members.map(m => m.id)))
  const reports = node.children.filter(c => !ledMemberIds.has(c.id))
  const hasBelow = node.ledTeams.length > 0 || reports.length > 0
  return (
    <li style={threadStyle}>
      <PersonCard p={node} />
      {hasBelow && (
        <ul>
          {node.ledTeams.map(t => <TeamBox key={t.name} team={t} />)}
          {reports.map(c => <Node key={c.id} node={c} />)}
        </ul>
      )}
    </li>
  )
}

function Tree({ roots }: { roots: OrgPerson[] }) {
  return (
    <div className="org-tree inline-block min-w-full">
      <ul>
        {roots.map(r => <Node key={r.id} node={r} />)}
      </ul>
    </div>
  )
}

export function OrgChart({ roots }: { roots: OrgPerson[] }) {
  const [full, setFull] = useState(false)

  if (roots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-10 text-center text-sm text-slate-400">
        The org chart appears here once the People directory is set up.
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setFull(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          Full screen
        </button>
      </div>
      <div className="overflow-x-auto pb-2">
        <Tree roots={roots} />
      </div>

      {full && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/80 backdrop-blur">
            <h2 className="text-sm font-bold text-slate-800">Organization</h2>
            <button
              type="button"
              onClick={() => setFull(false)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
            >
              Close ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-8">
            <Tree roots={roots} />
          </div>
        </div>
      )}
    </>
  )
}
