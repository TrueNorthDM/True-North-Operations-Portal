'use client'

/**
 * People > History, "The portal" tab: the portal's story in five chapters,
 * from lib/history/portal.ts (the source of truth; see its header before
 * adding anything). A chapter menu that follows the reader, as on the System
 * manual, and text at the full width of its column.
 */

import { useEffect, useState } from 'react'
import { BEGINNINGS, BUILT, MOVE, NEXT, NUMBERS, PURPOSE, TIMELINE, UPDATED, WHY } from '@/lib/history/portal'

const CHAPTERS = [
  { id: 'how-it-started', label: '1 · How it started' },
  { id: 'what-it-is-for', label: '2 · What it is for' },
  { id: 'what-we-built', label: '3 · What we built' },
  { id: 'the-move', label: '4 · The move' },
  { id: 'what-comes-next', label: '5 · What comes next' },
]

const card = 'rounded-2xl border border-slate-200 bg-white'
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.12em] text-tn-teal">{children}</div>
)
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-(family-name:--font-display) font-black text-[26px] leading-tight text-tn-ink mt-1">{children}</h2>
)
const H3 = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink ${className}`}>{children}</h3>
)
const P = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[14.5px] leading-[1.7] text-foreground ${className}`}>{children}</p>
)

// ── The horizontal timeline, to scale ────────────────────────────────
const DAY = 86_400_000
const t = (d: string) => Date.parse(d) / DAY
const T0 = t(TIMELINE.start)
const SPAN = t(TIMELINE.end) - T0
const X = (d: string) => Math.round((30 + ((t(d) - T0) / SPAN) * 940) * 10) / 10
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TICKS = (() => {
  const out: { x: number; word: string }[] = [{ x: X(TIMELINE.start), word: MONTH_WORDS[Number(TIMELINE.start.slice(5, 7)) - 1] }]
  const [y, m] = [Number(TIMELINE.start.slice(0, 4)), Number(TIMELINE.start.slice(5, 7))]
  for (let i = 1; ; i++) {
    const mm = ((m - 1 + i) % 12) + 1, yy = y + Math.floor((m - 1 + i) / 12)
    const iso = `${yy}-${String(mm).padStart(2, '0')}-01`
    if (iso > TIMELINE.end) break
    out.push({ x: X(iso), word: MONTH_WORDS[mm - 1] })
  }
  return out
})()
const SANS = 'var(--font-open-sans), sans-serif'
const DISPLAY = 'var(--font-raleway), sans-serif'

function Timeline() {
  const n = TIMELINE.marks.length
  return (
    <div className={`${card} px-2.5 pt-3.5 pb-1.5 overflow-x-auto`}>
      <svg viewBox="0 0 1000 220" role="img" aria-label={`The portal at a glance: ${TIMELINE.marks.map(m => `${m.words}, ${m.label}`).join('; ')}`} className="block w-full min-w-[760px] h-auto">
        <line x1={30} y1={116} x2={970} y2={116} stroke="#e4e7ec" strokeWidth={6} strokeLinecap="round" />
        <line x1={30} y1={116} x2={X(TIMELINE.reached)} y2={116} stroke="#F2C40A" strokeWidth={6} strokeLinecap="round" />
        {TICKS.map(k => (
          <g key={k.word + k.x}>
            <line x1={k.x} y1={112} x2={k.x} y2={124} stroke="#c9d1db" strokeWidth={1} />
            <text x={k.x + 4} y={138} fontSize={11.5} fill="#8593a4" fontFamily={SANS}>{k.word}</text>
          </g>
        ))}
        {TIMELINE.marks.map((m, i) => {
          const x = X(m.date)
          // Labels alternate between two rows; the first two read rightwards, the last two leftwards.
          const ty = i % 2 === 0 ? 32 : 62
          const anchor = i < 2 ? 'start' : i >= n - 2 ? 'end' : 'middle'
          const tx = anchor === 'middle' ? x : anchor === 'start' ? x - 2 : x + 6
          return (
            <g key={m.date}>
              <line x1={x} y1={ty + 12} x2={x} y2={108} stroke="#e4e7ec" strokeWidth={1.25} />
              {'key' in m && m.key
                ? <path d={`M${x} 107l9 9-9 9-9-9z`} fill="#012358" />
                : <path d={`M${x} 108l8 8-8 8-8-8z`} fill="#F2C40A" />}
              <text x={tx} y={ty - 6} textAnchor={anchor} fontFamily={DISPLAY} fontWeight={900} fontSize={12.5} fill="#012358">{m.words}</text>
              <text x={tx} y={ty + 8} textAnchor={anchor} fontFamily={SANS} fontSize={12} fill="#435066">{m.label}</text>
            </g>
          )
        })}
        {TIMELINE.months.map(mo => {
          const a = X(mo.from), b = X(mo.to)
          return (
            <g key={mo.from}>
              <rect x={a + 3} y={152} width={b - a - 6} height={54} rx={8} fill="#f6f4ee" />
              {mo.lines.map((line, i) => (
                <text key={line} x={(a + b) / 2} y={174 + i * 17} textAnchor="middle" fontFamily={SANS} fontSize={12} fill="#435066">{line}</text>
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── The tab ──────────────────────────────────────────────────────────
export function PortalHistory() {
  const [active, setActive] = useState(CHAPTERS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    for (const c of CHAPTERS) { const el = document.getElementById(c.id); if (el) observer.observe(el) }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[214px_1fr] gap-10 items-start">
      <nav className="lg:sticky lg:top-[81px] flex flex-col gap-0.5">
        <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.09em] text-muted px-3 pb-2">On this page</div>
        {CHAPTERS.map(c => (
          <a
            key={c.id}
            href={`#${c.id}`}
            onClick={() => setActive(c.id)}
            className={`text-[13px] px-3 py-[7px] rounded-lg border-l-2 transition-colors ${active === c.id ? 'border-tn-teal bg-tn-teal-soft text-tn-teal font-bold' : 'border-transparent text-muted font-semibold hover:text-tn-ink hover:bg-subtle'}`}
          >
            {c.label}
          </a>
        ))}
        <div className="mt-4 pt-3 px-3 border-t border-slate-200 text-xs leading-relaxed text-muted">
          Last updated<br /><strong className="font-bold text-foreground">{UPDATED}</strong>
        </div>
      </nav>

      <div className="min-w-0 flex flex-col gap-12">
        {/* The portal in numbers */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3" aria-label="The portal in numbers">
          <div className="rounded-[18px] bg-tn-ink px-6 py-5 flex flex-col justify-center gap-1.5">
            <span className="font-(family-name:--font-display) font-black text-[64px] leading-none text-[#ffffff]">{NUMBERS.headline.value}</span>
            <span className="text-[14px] text-[#c9d6ea]">{NUMBERS.headline.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {NUMBERS.facts.map(f => (
              <div key={f.label} className={`${card} px-4 py-3.5 flex flex-col gap-0.5`}>
                <span className="font-(family-name:--font-display) font-black text-[26px] leading-tight text-tn-ink tabular-nums whitespace-nowrap">{f.value}</span>
                <span className="text-[13px] text-muted">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <section id="how-it-started" className="scroll-mt-6 flex flex-col gap-4">
          <div><Eyebrow>Chapter 1</Eyebrow><H2>How and why the portal started</H2></div>
          <Timeline />
          <ol className="flex flex-col">
            {BEGINNINGS.map(b => (
              <li key={b.date} className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-6 py-3.5 relative">
                <div className="font-(family-name:--font-display) font-black text-[15px] text-tn-ink sm:text-right">{b.date}</div>
                <div className="relative pl-7 before:absolute before:left-[3px] before:top-1.5 before:w-3.5 before:h-3.5 before:rounded-full before:bg-tn-accent flex flex-col gap-1">
                  <H3>{b.title}</H3>
                  <P>{b.text}</P>
                </div>
              </li>
            ))}
          </ol>
          <div className={`${card} px-5 py-4`}><P><strong className="text-tn-ink">Why it exists.</strong> {WHY}</P></div>
        </section>

        <section id="what-it-is-for" className="scroll-mt-6 flex flex-col gap-4">
          <div><Eyebrow>Chapter 2</Eyebrow><H2>What it is for</H2></div>
          <p className="font-(family-name:--font-display) font-black text-[26px] leading-snug text-tn-ink border-l-4 border-tn-accent pl-4">{PURPOSE.line}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {PURPOSE.points.map(pt => (
              <div key={pt.title} className={`${card} p-4 flex flex-col gap-1.5`}>
                <H3 className="text-[15.5px]">{pt.title}</H3>
                <P className="text-[14px]">{pt.text}</P>
              </div>
            ))}
          </div>
        </section>

        <section id="what-we-built" className="scroll-mt-6 flex flex-col gap-4">
          <div><Eyebrow>Chapter 3</Eyebrow><H2>What we built, and how it helps the team</H2><P className="mt-1">In the order they arrived, each with the manual work it replaced.</P></div>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-[14px] border-collapse">
              <thead>
                <tr>{['When', 'What', 'How it helps'].map(h => <th key={h} className="text-left bg-subtle font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.1em] text-muted px-4 py-2.5 border-b border-slate-200">{h}</th>)}</tr>
              </thead>
              <tbody>
                {BUILT.map((r, i) => (
                  <tr key={r.what} className={`${i > 0 ? 'border-t border-slate-100' : ''} ${r.isNew ? 'bg-[#fdfaf0]' : ''}`}>
                    <td className="px-4 py-3 align-top whitespace-nowrap text-muted font-semibold">{r.when}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap font-(family-name:--font-display) font-extrabold text-tn-ink">
                      {r.what}
                      {r.isNew && <span className="ml-2 align-[2px] font-(family-name:--font-display) font-extrabold text-[10px] uppercase tracking-[.08em] text-[#8a6703] bg-[#fbf1cf] rounded-full px-2 py-0.5">New</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-foreground leading-relaxed">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="the-move" className="scroll-mt-6 flex flex-col gap-4">
          <div><Eyebrow>Chapter 4</Eyebrow><H2>The move to a home of its own</H2><P className="mt-1">{MOVE.intro}</P></div>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3.5">
            <div className="rounded-[18px] bg-tn-ink p-6 flex flex-col gap-2.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.12em] text-tn-accent">Done</span>
              <span className="font-(family-name:--font-display) font-black text-[52px] leading-none text-[#ffffff]">{MOVE.done.value}</span>
              <div className="h-2.5 rounded-full bg-[#ffffff26] overflow-hidden" aria-hidden="true"><div className="h-full w-full rounded-full bg-tn-accent" /></div>
              <p className="text-[14px] leading-relaxed text-[#c9d6ea]">{MOVE.done.text}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {MOVE.facts.map(f => (
                <div key={f.k} className={`${card} px-4 py-3`}>
                  <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.12em] text-tn-green">{f.k}</div>
                  <div className="font-(family-name:--font-display) font-black text-[18px] text-tn-ink">{f.v}</div>
                </div>
              ))}
            </div>
          </div>
          <H3 className="mt-2">Phase by phase</H3>
          <div className="flex flex-col gap-2.5">
            {MOVE.phases.map(ph => (
              <div key={ph.n} className={`rounded-2xl border px-4 py-3.5 grid grid-cols-[40px_1fr] sm:grid-cols-[40px_1fr_auto] gap-4 items-center ${'offline' in ph && ph.offline ? 'border-tn-accent bg-[#fffbea]' : 'border-slate-200 bg-white'}`}>
                <span className="w-10 h-10 rounded-full bg-tn-green text-[#ffffff] grid place-items-center font-(family-name:--font-display) font-black">{ph.n}</span>
                <div className="min-w-0"><H3 className="text-[15.5px]">{ph.title}</H3><P className="text-[14px]">{ph.text}</P></div>
                <div className="col-start-2 sm:col-start-auto sm:text-right font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink whitespace-nowrap">
                  {ph.dates}<span className="block font-sans font-semibold text-[12px] text-muted">{ph.steps} steps</span>
                </div>
              </div>
            ))}
          </div>
          <H3 className="mt-2">What moved where</H3>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-[14px] border-collapse">
              <thead>
                <tr>{['Piece', 'Before', 'Now'].map(h => <th key={h} className="text-left bg-subtle font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.1em] text-muted px-4 py-2.5 border-b border-slate-200">{h}</th>)}</tr>
              </thead>
              <tbody>
                {MOVE.moved.map((r, i) => (
                  <tr key={r.piece} className={i > 0 ? 'border-t border-slate-100' : ''}>
                    <td className="px-4 py-3 align-top whitespace-nowrap font-(family-name:--font-display) font-extrabold text-tn-ink">{r.piece}</td>
                    <td className="px-4 py-3 align-top text-muted">{r.before}</td>
                    <td className="px-4 py-3 align-top text-foreground">{r.now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="what-comes-next" className="scroll-mt-6 flex flex-col gap-4">
          <div><Eyebrow>Chapter 5</Eyebrow><H2>What comes next</H2><P className="mt-1">What is being built now, what is planned, and what is possible. Ideas and work in progress, not promises with dates.</P></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {NEXT.map(col => (
              <div key={col.kind} className={`${card} px-5 py-4 flex flex-col gap-2.5`}>
                <span className={`self-start font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.12em] rounded-full px-2.5 py-0.5 ${col.kind === 'building' ? 'bg-[#e6f6ee] text-[#0d7a4f]' : col.kind === 'planned' ? 'bg-tn-teal-soft text-tn-teal' : 'bg-subtle text-muted'}`}>{col.label}</span>
                <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[14px] leading-relaxed text-foreground marker:text-tn-teal">
                  {col.items.map(([b, rest]) => <li key={b}><strong className="text-tn-ink">{b}</strong>{rest}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
