/**
 * org/layout.ts: a computed "tidy tree" layout for the org chart.
 *
 * The browser's auto-flow tree reserves each subtree's full bounding-box width,
 * so a person with a big team pushes their leaf siblings far away. This computes
 * positions ourselves with a per-depth CONTOUR: leaf siblings only occupy their
 * own row, so they pack tight next to a wide-team sibling while that team simply
 * flows down (and under) them. Direct reports end up evenly spaced regardless of
 * how big one sibling's team is.
 *
 * Pure + deterministic (no DOM, no measuring): fixed card box so positions are
 * stable server-side. Bottom-level teams (all-leaf children) render as vertical
 * columns grouped by team, exactly as before, just placed by this engine.
 */

import type { OrgPerson } from './data'

export const CARD_W = 288
export const CARD_H = 92
const H_GAP = 30            // min horizontal gap between sibling subtrees
const V_GAP = 34            // vertical gap between rows
export const ROW_H = CARD_H + V_GAP
const COL_GAP = 24          // gap between a team's stacked columns

export interface PlacedCard { id: string; person: OrgPerson; x: number; y: number }
export interface PlacedEdge { key: string; kind: 'primary' | 'secondary'; color: string; d: string }
export interface OrgLayout { cards: PlacedCard[]; edges: PlacedEdge[]; width: number; height: number }

const NEUTRAL = '#cbd5e1'

interface LNode {
  person: OrgPerson
  kind: 'leaf' | 'stack' | 'branch'
  children: LNode[]                 // branch
  columns: OrgPerson[][]            // stack (leaf children grouped by team)
  x: number                         // center x, relative to this subtree's own frame
  contourL: number[]                // per relative row: min x
  contourR: number[]                // per relative row: max x
  rows: number                      // vertical rows this subtree spans
}

function stackColumns(children: OrgPerson[]): OrgPerson[][] {
  const groups = new Map<string, OrgPerson[]>()
  for (const c of children) {
    const key = c.primaryTeamName ?? '—'
    const arr = groups.get(key) ?? []
    arr.push(c)
    groups.set(key, arr)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, g]) => g)
}

function build(person: OrgPerson): LNode {
  const kids = person.children
  const half = CARD_W / 2

  if (kids.length === 0) {
    return { person, kind: 'leaf', children: [], columns: [], x: 0, contourL: [-half], contourR: [half], rows: 1 }
  }

  // Bottom-level team: all children are leaves -> vertical columns grouped by team.
  if (kids.length > 1 && kids.every(c => c.children.length === 0)) {
    const columns = stackColumns(kids)
    const stackRows = Math.max(...columns.map(c => c.length))
    const stackW = columns.length * CARD_W + (columns.length - 1) * COL_GAP
    const sh = stackW / 2
    const contourL = [-half]
    const contourR = [half]
    for (let r = 0; r < stackRows; r++) { contourL.push(-sh); contourR.push(sh) }
    return { person, kind: 'stack', children: [], columns, x: 0, contourL, contourR, rows: 1 + stackRows }
  }

  // Branch: lay out children subtrees, pack them by contour.
  const children = kids.map(build)
  // Pack left to right.
  const rightC: number[] = []
  for (let i = 0; i < children.length; i++) {
    const ch = children[i]
    if (i === 0) {
      ch.x = 0
    } else {
      let shift = 0
      const shared = Math.min(rightC.length, ch.contourL.length)
      for (let d = 0; d < shared; d++) {
        const need = rightC[d] - ch.contourL[d] + H_GAP
        if (need > shift) shift = need
      }
      ch.x = shift
    }
    for (let d = 0; d < ch.contourR.length; d++) {
      const r = ch.x + ch.contourR[d]
      rightC[d] = d < rightC.length ? Math.max(rightC[d], r) : r
    }
  }
  // Centre the parent over its children (midpoint of first and last), then
  // normalise so this node sits at x = 0.
  const centre = (children[0].x + children[children.length - 1].x) / 2
  for (const ch of children) ch.x -= centre

  const contourL = [-half]
  const contourR = [half]
  const maxRows = Math.max(...children.map(c => c.rows))
  for (let r = 0; r < maxRows; r++) {
    let l = Infinity, rr = -Infinity
    for (const ch of children) {
      if (r >= ch.contourL.length) continue
      l = Math.min(l, ch.x + ch.contourL[r])
      rr = Math.max(rr, ch.x + ch.contourR[r])
    }
    contourL.push(Number.isFinite(l) ? Math.min(-half, l) : -half)
    contourR.push(Number.isFinite(rr) ? Math.max(half, rr) : half)
  }
  return { person, kind: 'branch', children, columns: [], x: 0, contourL, contourR, rows: 1 + maxRows }
}

function elbow(px: number, py: number, cx: number, cy: number): string {
  const busY = py + V_GAP / 2
  return `M ${px} ${py} L ${px} ${busY} L ${cx} ${busY} L ${cx} ${cy}`
}

export function layoutOrg(roots: OrgPerson[]): OrgLayout {
  const cards: PlacedCard[] = []
  const edges: PlacedEdge[] = []
  const centreOf = new Map<string, { x: number; y: number }>() // person id -> card centre (for secondary lines)

  // Emit a subtree at absolute centre (ax) and depth. Returns nothing; fills arrays.
  function emit(node: LNode, ax: number, depth: number) {
    const y = depth * ROW_H
    const color = node.person.color ?? NEUTRAL
    cards.push({ id: node.person.id, person: node.person, x: ax - CARD_W / 2, y })
    centreOf.set(node.person.id, { x: ax, y: y + CARD_H / 2 })

    if (node.kind === 'stack') {
      const stackW = node.columns.length * CARD_W + (node.columns.length - 1) * COL_GAP
      let colLeft = ax - stackW / 2
      for (const col of node.columns) {
        const colCentre = colLeft + CARD_W / 2
        col.forEach((p, k) => {
          const cy = (depth + 1 + k) * ROW_H
          cards.push({ id: p.id, person: p, x: colCentre - CARD_W / 2, y: cy })
          centreOf.set(p.id, { x: colCentre, y: cy + CARD_H / 2 })
          edges.push({ key: `p-${p.id}`, kind: 'primary', color: p.color ?? color, d: elbow(ax, y + CARD_H, colCentre, cy) })
        })
        colLeft += CARD_W + COL_GAP
      }
      return
    }

    for (const ch of node.children) {
      const cx = ax + ch.x
      edges.push({ key: `p-${ch.person.id}`, kind: 'primary', color: ch.person.color ?? NEUTRAL, d: elbow(ax, y + CARD_H, cx, (depth + 1) * ROW_H) })
      emit(ch, cx, depth + 1)
    }
  }

  // Lay out each root, then place roots side by side by contour.
  const built = roots.map(build)
  let rootLeft = 0
  for (const b of built) {
    const ax = rootLeft - Math.min(...b.contourL) // shift so its leftmost is at rootLeft
    emit(b, ax, 0)
    const w = Math.max(...b.contourR) - Math.min(...b.contourL)
    rootLeft += w + H_GAP * 2
  }

  // Normalise to a 0-based canvas + a small margin.
  const MARGIN = 40
  const minX = Math.min(...cards.map(c => c.x))
  const shift = MARGIN - minX
  for (const c of cards) c.x += shift
  for (const [, v] of centreOf) v.x += shift

  // Secondary dotted lines (also_reports_to), drawn as smooth curves between centres.
  for (const c of cards) {
    const to = c.person.secondaryManagerId
    if (!to || to === c.person.id) continue
    const a = centreOf.get(c.person.id), b = centreOf.get(to)
    if (!a || !b) continue
    const my = (a.y + b.y) / 2
    edges.push({ key: `s-${c.person.id}`, kind: 'secondary', color: '#94a3b8', d: `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}` })
  }

  const width = Math.max(0, ...cards.map(c => c.x + CARD_W)) + MARGIN
  const height = Math.max(0, ...cards.map(c => c.y + CARD_H)) + MARGIN
  return { cards, edges, width, height }
}
