/**
 * HreflangAuditView — presentational, server-rendered. Renders the Run Link
 * audit (see lib/hreflang/audit.ts): a reconciliation of the system's pages
 * against Monday's live Href Link status, with problems surfaced first.
 *
 * No interactivity → no 'use client'. The rows are already sorted/labelled by
 * the data layer; this file only styles them.
 */

import type { AuditStatus, HreflangAudit } from '@/lib/hreflang/audit'

const STATUS_META: Record<AuditStatus, { label: string; dot: string; chip: string; problem: boolean }> = {
  stale_desync: { label: 'Encalhada', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700', problem: true },
  orphan_system: { label: 'Órfã', dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-700', problem: true },
  missing_system: { label: 'Faltando no sistema', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700', problem: true },
  apply_awaiting: { label: 'Aguardando Done', dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700', problem: false },
  run_in_progress: { label: 'Em andamento', dot: 'bg-yellow-500', chip: 'bg-yellow-100 text-yellow-700', problem: false },
  completed: { label: 'Concluída', dot: 'bg-green-500', chip: 'bg-green-100 text-green-700', problem: false },
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} min atrás`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.round(hrs / 24)}d atrás`
}

export function HreflangAuditView({ audit, siteCode }: { audit: HreflangAudit; siteCode: 'aaaf' | 'hfa' }) {
  const { counts, languages } = audit
  const problemCount =
    counts.byStatus.stale_desync + counts.byStatus.orphan_system + counts.byStatus.missing_system

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href={`/${siteCode}`} className="hover:text-slate-800">{siteCode.toUpperCase()}</a>
          <span>/</span>
          <span>Run Link Audit</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Run Link Audit</h1>
        <p className="text-slate-500 text-sm mt-1">
          Reconciliação entre o que o sistema capturou e o status atual do{' '}
          <span className="font-medium">Href Link</span> no Monday.
          {' '}Snapshot atualizado <span className="font-medium">{timeAgo(audit.snapshotIngestedAt)}</span>.
        </p>
      </div>

      {/* Snapshot doesn't have the Href Link column yet → can't audit. */}
      {!audit.hasHrefColumn ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold mb-1">⏳ O snapshot ainda não tem a coluna Href Link.</p>
          <p>
            A ingestão dessa coluna acabou de ser ativada. Rode o cron{' '}
            <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-xs">/api/cron/ingest</code>{' '}
            (ou espere a próxima execução agendada) e recarregue esta página. Aí o audit cruza o status
            Run/Apply/Done real de cada item.
          </p>
        </div>
      ) : (
        <>
          {/* Reconciliation summary — the headline numbers. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Sistema (On-going)" value={counts.systemOngoing} hint="páginas não concluídas" />
            <Stat label="Monday (Run Link)" value={counts.mondayRunLink} hint="itens em Run Link agora" />
            <Stat
              label="Desync (encalhadas)"
              value={counts.byStatus.stale_desync}
              hint="URL no sistema, fora do Run Link"
              tone={counts.byStatus.stale_desync > 0 ? 'red' : 'ok'}
            />
            <Stat
              label="Outros problemas"
              value={counts.byStatus.orphan_system + counts.byStatus.missing_system}
              hint="órfãs + faltando no sistema"
              tone={counts.byStatus.orphan_system + counts.byStatus.missing_system > 0 ? 'amber' : 'ok'}
            />
          </div>

          {problemCount === 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              ✓ Nenhuma divergência — sistema e Monday estão em sincronia.
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">Página</th>
                  <th className="px-5 py-3 font-medium w-44">Status</th>
                  {languages.map((l) => (
                    <th key={l} className="px-3 py-3 font-medium w-28 text-center uppercase">{l}</th>
                  ))}
                  <th className="px-5 py-3 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((r) => {
                  const meta = STATUS_META[r.status]
                  return (
                    <tr key={r.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>
                      {r.langs.map((l) => (
                        <td key={l.code} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`inline-flex items-center justify-center min-w-7 h-6 px-1.5 rounded text-xs font-semibold uppercase ${
                                l.hasUrl ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
                              }`}
                              title={l.hasUrl ? 'URL no sistema' : 'sem URL'}
                            >
                              {l.confirmed ? '✓' : l.hasUrl ? '•' : '–'}
                            </span>
                            <span className={`text-[10px] leading-tight ${l.mondayHref ? 'text-slate-500' : 'text-slate-300'}`}>
                              {l.mondayHref === null ? '—' : l.mondayHref === '' ? '(vazio)' : l.mondayHref}
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="px-5 py-3 text-xs text-slate-500">{r.note}</td>
                    </tr>
                  )
                })}
                {audit.rows.length === 0 && (
                  <tr>
                    <td colSpan={3 + languages.length} className="px-5 py-12 text-center text-slate-400">
                      Nada para reconciliar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="text-xs text-slate-500 flex flex-wrap gap-x-5 gap-y-1">
            <span><strong>Coluna por idioma:</strong> ✓ live (Done) · • URL no sistema · – sem URL; abaixo, o label atual do Monday.</span>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'ok',
}: {
  label: string
  value: number
  hint: string
  tone?: 'ok' | 'red' | 'amber'
}) {
  const toneCls =
    tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-800'
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>
    </div>
  )
}
