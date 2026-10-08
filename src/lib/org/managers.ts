/**
 * Who each person hangs under on the org chart: their manager, when that
 * manager is on the chart. Then any reporting loop (A under B under A, or
 * longer) is cut at the first repeat, so that person becomes a root instead of
 * the whole loop, and everyone under it, vanishing from the chart.
 *
 * Saving a manager refuses a loop (lib/directory/person-writes wouldCreateCycle),
 * so this is the second guard, for data that arrived another way.
 */
export function effectiveManagers(
  people: readonly { id: string; manager_id: string | null }[],
  onChart: (id: string) => boolean,
): Map<string, string | null> {
  const eff = new Map<string, string | null>()
  for (const p of people) eff.set(p.id, p.manager_id && onChart(p.manager_id) ? p.manager_id : null)
  for (const p of people) {
    const seen = new Set<string>()
    let cur: string | null = p.id
    while (cur) {
      if (seen.has(cur)) { eff.set(cur, null); break }
      seen.add(cur)
      cur = eff.get(cur) ?? null
    }
  }
  return eff
}
