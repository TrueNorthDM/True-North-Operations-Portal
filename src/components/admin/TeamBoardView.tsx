/**
 * TeamBoardView — renders the "True North Team" Monday board faithfully: one
 * section per group (coloured accent), a table per group whose columns match the
 * board, and cells rendered by type (status → coloured pill, people → avatars,
 * everything else → its display text). Read-only mirror of the live board.
 */

import type { TeamBoard, TeamBoardCell } from '@/lib/monday/team-board'

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'
}

// Readable text colour for a status pill background (white on dark, ink on light).
function onColor(hex?: string | null): string {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.replace('#', ''))) return '#ffffff'
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#1e2a3b' : '#ffffff'
}

function Cell({ cell }: { cell?: TeamBoardCell }) {
  const isStatus = cell && (cell.type === 'status' || cell.type === 'color')
  // color-only status (a coloured swatch with no label) → a dot, not a dash.
  if (isStatus && !cell!.text && cell!.color) {
    return <span className="inline-block w-4 h-4 rounded-[5px]" style={{ background: cell!.color }} />
  }
  if (!cell || (!cell.text && !cell.names?.length)) return <span className="text-slate-300">—</span>

  if (isStatus && cell.text) {
    const bg = cell.color ?? '#c4c4c4'
    return <span className="inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-(family-name:--font-display) font-bold whitespace-nowrap" style={{ background: bg, color: onColor(bg) }}>{cell.text}</span>
  }

  if (cell.names?.length) {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        {cell.names.map((n, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-subtle border border-slate-200 pl-0.5 pr-2.5 py-0.5">
            <span className="w-[22px] h-[22px] rounded-full bg-tn-primary text-white inline-flex items-center justify-center text-[9px] font-(family-name:--font-display) font-extrabold">{initials(n)}</span>
            <span className="text-[12.5px] text-foreground">{n}</span>
          </span>
        ))}
      </span>
    )
  }

  // dropdown / tags → each label as a soft pill.
  if (cell.type === 'dropdown' || cell.type === 'tags') {
    const labels = cell.text.split(',').map(s => s.trim()).filter(Boolean)
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        {labels.map((l, i) => <span key={i} className="inline-flex items-center rounded-[6px] bg-tn-teal-soft text-tn-teal px-2 py-1 text-[11.5px] font-(family-name:--font-display) font-bold whitespace-nowrap">{l}</span>)}
      </span>
    )
  }

  // checkbox / boolean → a check when set.
  if (cell.type === 'checkbox' || cell.type === 'boolean') {
    return <svg className="w-4 h-4 text-[#16875a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="yes"><path d="M20 6 9 17l-5-5" /></svg>
  }

  if (cell.type === 'email' && cell.text) {
    return <a href={`mailto:${cell.text}`} className="text-[13px] text-tn-teal hover:underline">{cell.text}</a>
  }

  // long text → clamp to 2 lines so one big entry doesn't blow up the row.
  if (cell.type === 'long_text' || cell.type === 'long-text') {
    return <span className="block max-w-[300px] text-[13px] text-foreground leading-snug line-clamp-2 whitespace-normal" title={cell.text}>{cell.text}</span>
  }

  return <span className="text-[13px] text-foreground tabular-nums">{cell.text}</span>
}

const GROUP_COLORS: Record<string, string> = {
  'grass_green': '#037f4c', 'done-green': '#00c875', 'bright-green': '#9cd326', 'saladish': '#cab641',
  'egg_yolk': '#ffcb00', 'working_orange': '#fdab3d', 'dark-orange': '#ff642e', 'peach': '#ffadad',
  'sunset': '#ff5ac4', 'stuck-red': '#e2445c', 'dark-red': '#bb3354', 'sofia_pink': '#ff158a',
  'lipstick': '#ff5ac4', 'purple': '#a25ddc', 'dark_purple': '#784bd1', 'berry': '#7e3b8a',
  'dark-blue': '#0086c0', 'bright-blue': '#579bfc', 'aquamarine': '#4eccc6', 'chili-blue': '#66ccff',
  'river': '#68a1bd', 'winter': '#9aadbd', 'explosive': '#808080', 'american_gray': '#9d99b9',
  'blackish': '#333333', 'navy': '#225091',
}
const groupHex = (c: string) => GROUP_COLORS[c] ?? '#579bfc'

export function TeamBoardView({ board }: { board: TeamBoard }) {
  if (!board.ok) {
    return (
      <div className="rounded-[16px] border border-slate-200 bg-white p-8 text-center space-y-2 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <p className="text-sm font-(family-name:--font-display) font-bold text-tn-ink">Couldn&rsquo;t load the board</p>
        <p className="text-xs text-muted max-w-md mx-auto">{board.error}</p>
      </div>
    )
  }

  const th = 'text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 whitespace-nowrap'

  return (
    <div className="space-y-7">
      {board.groups.map(group => (
        <div key={group.id}>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="w-1 h-5 rounded-full" style={{ background: groupHex(group.color) }} />
            <h2 className="font-(family-name:--font-display) font-extrabold text-[16px]" style={{ color: groupHex(group.color) }}>{group.title}</h2>
            <span className="text-[11px] font-(family-name:--font-display) font-bold text-muted bg-subtle rounded-full px-2 py-0.5">{group.items.length}</span>
          </div>
          {group.items.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-slate-200 bg-subtle px-4 py-6 text-center text-xs text-muted">No items in this group</div>
          ) : (
            <div className="rounded-[14px] border border-slate-200 bg-white overflow-x-auto shadow-[0_1px_2px_rgba(1,35,88,.06)]">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-subtle border-b border-slate-200">
                    <th className={`${th} sticky left-0 bg-subtle`} style={{ borderLeft: `3px solid ${groupHex(group.color)}` }}>Name</th>
                    {board.columns.map(col => <th key={col.id} className={th}>{col.title}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-subtle/60">
                      <td className="px-4 py-3 sticky left-0 bg-white font-(family-name:--font-display) font-bold text-tn-ink whitespace-nowrap" style={{ borderLeft: `3px solid ${groupHex(group.color)}` }}>{item.name}</td>
                      {board.columns.map(col => (
                        <td key={col.id} className="px-4 py-3 align-middle whitespace-nowrap"><Cell cell={item.cells[col.id]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
