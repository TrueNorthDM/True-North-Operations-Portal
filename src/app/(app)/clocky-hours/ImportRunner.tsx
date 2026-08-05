'use client'

// The button that drives the migration.
//
// One call cannot finish 136,167 entries, so this keeps calling until the server
// says there is no next month. The loop lives in the browser rather than in the
// function because the progress is worth watching: a migration that reports
// nothing for 45 minutes is one nobody trusts.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Report {
  state: 'running' | 'done' | 'failed'
  monthsDone: string[]
  entriesWritten: number
  entriesDeleted: number
  nextMonth: string | null
  error?: string
  elapsedMs: number
}

type Kind = 'full' | 'delta' | 'recheck'

export function ImportRunner({ hasCutoff, mismatched }: { hasCutoff: boolean; mismatched: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Kind | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [written, setWritten] = useState(0)

  async function run(kind: Kind) {
    setBusy(kind)
    setLines([])
    setWritten(0)
    let total = 0

    // Bounded so a server that always answers "more to do" cannot spin forever.
    let misses = 0
    for (let call = 1; call <= 120; call++) {
      let report: Report
      try {
        // With no timeout, a reply that never arrives blocks the loop forever:
        // the server carries on importing, the screen sits still, and the two
        // disagree with nobody able to tell. 200s is past any healthy slice.
        const res = await fetch(`/api/admin/timeclock/import?kind=${kind}`, {
          method: 'POST',
          signal: AbortSignal.timeout(200_000),
        })
        report = await res.json()
        misses = 0
      } catch (e) {
        // A call that dies on the platform's own time limit still did its work
        // and still moved the cursor, so the right answer is to call again, not
        // to stop. Only a run of failures means something is actually wrong.
        misses++
        setLines(l => [...l, `Call ${call} came back empty (${e instanceof Error ? e.message : e}). Continuing from the saved cursor.`])
        if (misses >= 3) {
          setLines(l => [...l, 'Three calls in a row failed. Stopping.'])
          break
        }
        continue
      }

      total += report.entriesWritten
      setWritten(total)
      const span = report.monthsDone.length
        ? `${report.monthsDone[0]} → ${report.monthsDone[report.monthsDone.length - 1]}`
        : 'nothing new'
      setLines(l => [...l, `${span} · ${report.entriesWritten.toLocaleString()} entries · ${Math.round(report.elapsedMs / 1000)}s`])

      if (report.state === 'failed') {
        setLines(l => [...l, `Stopped: ${report.error ?? 'unknown error'}`])
        break
      }
      if (!report.nextMonth) {
        setLines(l => [...l, report.entriesDeleted ? `Done. ${report.entriesDeleted} deleted upstream were removed here too.` : 'Done.'])
        break
      }
    }

    setBusy(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          onClick={() => run('full')}
          disabled={busy !== null}
          className="px-4 py-2.5 rounded-[10px] bg-tn-primary text-white font-(family-name:--font-display) font-bold text-sm disabled:opacity-50 transition-transform hover:-translate-y-0.5 disabled:translate-y-0"
        >
          {busy === 'full' ? 'Importing…' : 'Run full import'}
        </button>
        <button
          onClick={() => run('delta')}
          disabled={busy !== null}
          className="px-4 py-2.5 rounded-[10px] border border-slate-200 bg-white text-tn-ink font-(family-name:--font-display) font-bold text-sm disabled:opacity-50 hover:border-tn-teal transition-colors"
        >
          {busy === 'delta' ? 'Catching up…' : 'Catch up (delta)'}
        </button>
        {mismatched > 0 && (
          <button
            onClick={() => run('recheck')}
            disabled={busy !== null}
            className="px-4 py-2.5 rounded-[10px] border border-[#c2410c]/40 bg-white text-[#c2410c] font-(family-name:--font-display) font-bold text-sm disabled:opacity-50 hover:border-[#c2410c] transition-colors"
          >
            {busy === 'recheck' ? 'Re-checking…' : `Re-check ${mismatched} month${mismatched === 1 ? '' : 's'}`}
          </button>
        )}
        {busy && <span className="text-sm text-muted tabular-nums">{written.toLocaleString()} entries so far</span>}
      </div>

      {!hasCutoff && (
        <p className="text-sm text-muted m-0">
          No cutoff date is set, so the import stops at today and QuickBooks Time stays the source of truth.
          Fix a date here only on the day you switch over.
        </p>
      )}

      {lines.length > 0 && (
        <ul className="rounded-[12px] border border-slate-200 bg-subtle p-4 space-y-1 text-sm font-mono text-foreground m-0 list-none max-h-64 overflow-y-auto">
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  )
}
