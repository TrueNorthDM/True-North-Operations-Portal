// A moment as the portal writes it for people (audit, 10 October 2026,
// decided by Arnaldo): New York time, 12-hour clock, labelled ET. The server
// runs on UTC, so a time formatted without a zone read as UTC on Automations
// and Settings, and some places used a 24-hour clock.

const ZONE = 'America/New_York'

/** "Oct 9, 2026, 3:05 PM ET". */
export function formatEt(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleString('en-US', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} ET`
}

/** "3:05 PM ET". */
export function formatEtTime(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleTimeString('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true })} ET`
}
