/**
 * SystemManual — renders the System Manual (data from lib/manual/data.ts).
 * Server-rendered; a jump-link table of contents plus the sections. No state.
 */

import { MANUAL, MANUAL_UPDATED, type ManualBlock } from '@/lib/manual/data'

function Block({ block }: { block: ManualBlock }) {
  switch (block.kind) {
    case 'p':
      return <p className="text-sm text-slate-600 leading-relaxed">{block.text}</p>
    case 'subhead':
      return <h3 className="text-sm font-semibold text-slate-800 mt-4">{block.text}</h3>
    case 'note':
      return (
        <p className="text-sm text-slate-600 leading-relaxed rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          {block.text}
        </p>
      )
    case 'list':
      return (
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )
    case 'steps':
      return (
        <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-600">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ol>
      )
    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {block.head.map(h => <th key={h} className="px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export function SystemManual() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/admin" className="hover:text-slate-800">Admin</a>
          <span>/</span>
          <span>System manual</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">System manual</h1>
        <p className="mt-1 text-sm text-slate-500">How the portal works — pages, access, and how Monday feeds it. Updated {MANUAL_UPDATED}.</p>
      </div>

      {/* Table of contents */}
      <nav className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Contents</div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {MANUAL.map(s => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline">{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      {MANUAL.map(section => (
        <section key={section.id} id={section.id} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
          {section.body.map((block, i) => <Block key={i} block={block} />)}
        </section>
      ))}
    </div>
  )
}
