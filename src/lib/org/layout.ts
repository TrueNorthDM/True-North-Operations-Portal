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

import type { OrgPerson, OrgGhost } from './data'

export const CARD_W = 288
export const CARD_H = 92
const H_GAP = 58            // min horizontal gap between sibling subtrees
const V_GAP = 62            // vertical gap between rows
export const ROW_H = CARD_H + V_GAP
const COL_GAP = 44          // gap between a team's stacked columns
const LINE = '#aab0bb'      // single neutral colour for every connector

export interface PlacedCard { id: string; x: number; y: number; person?: OrgPerson; ghost?: OrgGhost }
export interface PlacedEdge { key: string; kind: 'primary' | 'secondary'; color: string; d: string }
export interface OrgLayout { cards: PlacedCard[]; edges: PlacedEdge[]; width: number; height: number }

type StackItem = { kind: 'solid'; person: OrgPerson } | { kind: 'ghost'; ghost: OrgGhost }

interface LNode {
  person: OrgPerson
  kind: 'leaf' | 'stack' | 'branch'
  children: LNode[]                 // branch
  columns: StackItem[][]            // stack: team columns of solid + ghost members
  x: number                         // center x, relative to this subtree's own frame
  contourL: number[]                // per relative row: min x
  contourR: number[]                // per relative row: max x
  rows: number                      // vertical rows this subtree spans
}

// Team columns: leaf reports grouped by their primary team (solid) merged with
// ghost members grouped by the team they're borrowed into. One column per team.
function stackColumns(children: OrgPerson[], ghosts: OrgGhost[]): StackItem[][] {
  const groups = new Map<string, StackItem[]>()
  const push = (key: string, item: StackItem) => {
    const arr = groups.get(key) ?? []
    arr.push(item)
    groups.set(key, arr)
  }
  for (const c of children) push(c.primaryTeamName ?? '-', { kind: 'solid', person: c })
  for (const g of ghosts) push(g.onTeamName, { kind: 'ghost', ghost: g })
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, g]) => g)
}

function build(person: OrgPerson): LNode {
  const kids = person.children
  const ghosts = person.ghosts ?? []
  const half = CARD_W / 2

  if (kids.length === 0 && ghosts.length === 0) {
    return { person, kind: 'leaf', children: [], columns: [], x: 0, contourL: [-half], contourR: [half], rows: 1 }
  }

  // A team group: all children are leaves, and there are members to show
  // (2+ reports, or any borrowed ghost). Render vertical columns per team.
  const allLeaf = kids.every(c => c.children.length === 0)
  if (allLeaf && (kids.length >= 2 || ghosts.length >= 1)) {
    const columns = stackColumns(kids, ghosts)
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
  const MARGIN = 40 // baked into every position so cards and edges stay aligned

  // Emit a subtree at absolute centre (ax) and depth. Returns nothing; fills arrays.
  function emit(node: LNode, ax: number, depth: number) {
    const y = depth * ROW_H + MARGIN
    cards.push({ id: node.person.id, person: node.person, x: ax - CARD_W / 2, y })

    if (node.kind === 'stack') {
      const stackW = node.columns.length * CARD_W + (node.columns.length - 1) * COL_GAP
      let colLeft = ax - stackW / 2
      for (const col of node.columns) {
        const colCentre = colLeft + CARD_W / 2
        col.forEach((item, k) => {
          const cy = (depth + 1 + k) * ROW_H + MARGIN
          if (item.kind === 'solid') {
            const p = item.person
            cards.push({ id: p.id, x: colCentre - CARD_W / 2, y: cy, person: p })
            edges.push({ key: `p-${p.id}`, kind: 'primary', color: LINE, d: elbow(ax, y + CARD_H, colCentre, cy) })
          } else {
            const g = item.ghost
            const id = `g-${g.id}-${g.onTeamName}`
            cards.push({ id, x: colCentre - CARD_W / 2, y: cy, ghost: g })
            edges.push({ key: `p-${id}`, kind: 'primary', color: LINE, d: elbow(ax, y + CARD_H, colCentre, cy) })
          }
        })
        colLeft += CARD_W + COL_GAP
      }
      return
    }

    for (const ch of node.children) {
      const cx = ax + ch.x
      edges.push({ key: `p-${ch.person.id}`, kind: 'primary', color: LINE, d: elbow(ax, y + CARD_H, cx, (depth + 1) * ROW_H + MARGIN) })
      emit(ch, cx, depth + 1)
    }
  }

  // Lay out each root, then place roots side by side by contour. Starting at
  // MARGIN keeps the leftmost content padded without a post-shift.
  const built = roots.map(build)
  let rootLeft = MARGIN
  for (const b of built) {
    const ax = rootLeft - Math.min(...b.contourL) // shift so its leftmost is at rootLeft
    emit(b, ax, 0)
    const w = Math.max(...b.contourR) - Math.min(...b.contourL)
    rootLeft += w + H_GAP * 2
  }

  const width = Math.max(0, ...cards.map(c => c.x + CARD_W)) + MARGIN
  const height = Math.max(0, ...cards.map(c => c.y + CARD_H)) + MARGIN
  return { cards, edges, width, height }
}
