/**
 * csv.ts — tiny client-side CSV builder + download.
 * Used by the Boards Review views' "Export CSV" buttons.
 */

function escapeCell(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
}

/** Trigger a CSV file download in the browser. Client-side only. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
