// Design check: three ways to show English apart from the total.
//
// Real figures from the snapshot, not invented ones. They matter to the choice:
// English is 2 of AAAF's 11 weekly target and was missed in three of the four
// weeks, while the total looks healthy. Any layout that makes English look like
// a co-equal half of the card is lying about its size; any layout that hides it
// loses the only place that miss is visible.

const NAVY = 'text-tn-ink'
const GREEN = '#1E9E6A'
const AMBER_TEXT = '#b06d0a'
const AMBER_BAR = '#e08a1e'

interface W { label: string; all: [number, number]; en: [number, number] }
interface B { name: string; perWeek: number; enPerWeek: number; weeks: W[] }

const DATA: B[] = [
  {
    name: 'AskAnAdventistFriend', perWeek: 11, enPerWeek: 2,
    weeks: [
      { label: 'Aug 10', all: [9, 11], en: [0, 2] },
      { label: 'Aug 17', all: [3, 11], en: [0, 2] },
      { label: 'Aug 24', all: [15, 11], en: [0, 2] },
      { label: 'Aug 31', all: [9, 11], en: [1, 2] },
    ],
  },
  {
    name: 'Hope for Africa', perWeek: 10, enPerWeek: 5,
    weeks: [
      { label: 'Aug 10', all: [10, 10], en: [5, 5] },
      { label: 'Aug 17', all: [4, 10], en: [2, 5] },
      { label: 'Aug 24', all: [16, 10], en: [8, 5] },
      { label: 'Aug 31', all: [8, 10], en: [3, 5] },
    ],
  },
]

const pct = ([d, t]: [number, number]) => (t ? Math.round((100 * d) / t) : 0)
const hit = ([d, t]: [number, number]) => d >= t

function Shell({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="max-w-[680px]">
      <div className="mb-2">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">{title}</h2>
        <p className="text-[12.5px] text-muted m-0 mt-0.5 leading-relaxed">{note}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3">
          <span className="font-(family-name:--font-display) font-extrabold text-lg text-white">Publishing goals</span>
          <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">Last 4 weeks</span>
        </div>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </div>
  )
}

function Head({ b, right }: { b: B; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-2.5">
      <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{b.name}</span>
      {right ?? <span className="text-[11.5px] text-muted whitespace-nowrap">{b.perWeek}/wk</span>}
    </div>
  )
}

/* ---------------- A: one row, English as a chip, two-tone bar ---------------- */

function VariantA() {
  return (
    <Shell
      title="A. English inside the bar"
      note="One row per week, as now. The total keeps the big percentage; English is a chip on the right and a darker segment of the same bar, so its share is read against the whole rather than beside it."
    >
      {DATA.map(b => (
        <div key={b.name}>
          <Head b={b} right={
            <span className="text-[11.5px] text-muted whitespace-nowrap">
              {b.perWeek}/wk <span className="text-tn-ink/50">·</span> {b.enPerWeek} EN
            </span>
          } />
          <div className="space-y-3">
            {b.weeks.map(w => {
              const p = pct(w.all)
              const enShare = Math.min(100, (w.en[0] / w.all[1]) * 100)
              const restShare = Math.min(100 - enShare, ((w.all[0] - w.en[0]) / w.all[1]) * 100)
              return (
                <div key={w.label} className="flex items-center gap-4">
                  <span className="w-[52px] shrink-0 text-[11.5px] text-muted tabular-nums">{w.label}</span>
                  <span className="w-[54px] shrink-0 text-right text-[13px] font-(family-name:--font-display) font-extrabold tabular-nums" style={{ color: hit(w.all) ? GREEN : AMBER_TEXT }}>
                    {w.all[0]}/{w.all[1]}
                  </span>
                  <span className={`w-[74px] shrink-0 text-right text-[26px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums ${NAVY}`}>
                    {p}<span className="text-[15px]">%</span>
                  </span>
                  <span className="flex-1 h-2.5 rounded-full bg-subtle overflow-hidden flex">
                    <span className="block h-full" style={{ width: `${enShare}%`, background: '#012358' }} />
                    <span className="block h-full" style={{ width: `${restShare}%`, background: hit(w.all) ? GREEN : AMBER_BAR }} />
                  </span>
                  <span className="w-[52px] shrink-0 text-right text-[11.5px] font-bold tabular-nums" style={{ color: hit(w.en) ? GREEN : AMBER_TEXT }}>
                    {w.en[0]}/{w.en[1]} EN
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted m-0 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#012358' }} /> English</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: GREEN }} /> Other languages</span>
          </p>
        </div>
      ))}
    </Shell>
  )
}

/* ---------------- B: two columns of figures ---------------- */

function VariantB() {
  return (
    <Shell
      title="B. Two columns, both with a percentage"
      note="All languages and English each get a count and a percentage, side by side. English's percentage is smaller because English is a part of the total, not a rival to it. The bar still tracks the total."
    >
      {DATA.map(b => (
        <div key={b.name}>
          <Head b={b} right={
            <span className="text-[11.5px] text-muted whitespace-nowrap">{b.perWeek}/wk <span className="text-tn-ink/50">·</span> {b.enPerWeek} EN</span>
          } />
          <div className="flex items-center gap-4 pb-1.5">
            <span className="w-[52px] shrink-0" />
            <span className="w-[128px] shrink-0 text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">All languages</span>
            <span className="w-[96px] shrink-0 text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">English</span>
            <span className="flex-1" />
          </div>
          <div className="space-y-3">
            {b.weeks.map(w => (
              <div key={w.label} className="flex items-center gap-4">
                <span className="w-[52px] shrink-0 text-[11.5px] text-muted tabular-nums">{w.label}</span>
                <span className="w-[128px] shrink-0 flex items-baseline justify-end gap-2">
                  <span className="text-[13px] font-(family-name:--font-display) font-extrabold tabular-nums" style={{ color: hit(w.all) ? GREEN : AMBER_TEXT }}>{w.all[0]}/{w.all[1]}</span>
                  <span className={`text-[26px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums ${NAVY}`}>{pct(w.all)}<span className="text-[15px]">%</span></span>
                </span>
                <span className="w-[96px] shrink-0 flex items-baseline justify-end gap-1.5 border-l border-slate-200 pl-3">
                  <span className="text-[11.5px] font-bold tabular-nums" style={{ color: hit(w.en) ? GREEN : AMBER_TEXT }}>{w.en[0]}/{w.en[1]}</span>
                  <span className={`text-[17px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums ${NAVY}`}>{pct(w.en)}<span className="text-[11px]">%</span></span>
                </span>
                <span className="flex-1 h-2.5 rounded-full bg-subtle overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct(w.all))}%`, background: hit(w.all) ? GREEN : AMBER_BAR }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  )
}

/* ---------------- C: two lines per week ---------------- */

function VariantC() {
  return (
    <Shell
      title="C. A line each, stacked"
      note="Every week is two lines: all languages, then English underneath at the same shape but smaller. The most literal reading of two separate figures, and the tallest. Each gets its own bar, so a bad English week is visible at a glance."
    >
      {DATA.map(b => (
        <div key={b.name}>
          <Head b={b} />
          <div className="space-y-3.5">
            {b.weeks.map(w => (
              <div key={w.label} className="flex items-center gap-4">
                <span className="w-[52px] shrink-0 text-[11.5px] text-muted tabular-nums">{w.label}</span>
                <span className="flex-1 space-y-1.5">
                  <span className="flex items-center gap-3">
                    <span className="w-[38px] shrink-0 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">All</span>
                    <span className="w-[46px] shrink-0 text-right text-[13px] font-(family-name:--font-display) font-extrabold tabular-nums" style={{ color: hit(w.all) ? GREEN : AMBER_TEXT }}>{w.all[0]}/{w.all[1]}</span>
                    <span className={`w-[70px] shrink-0 text-right text-[24px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums ${NAVY}`}>{pct(w.all)}<span className="text-[14px]">%</span></span>
                    <span className="flex-1 h-2.5 rounded-full bg-subtle overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct(w.all))}%`, background: hit(w.all) ? GREEN : AMBER_BAR }} />
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="w-[38px] shrink-0 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Eng</span>
                    <span className="w-[46px] shrink-0 text-right text-[11.5px] font-(family-name:--font-display) font-extrabold tabular-nums" style={{ color: hit(w.en) ? GREEN : AMBER_TEXT }}>{w.en[0]}/{w.en[1]}</span>
                    <span className={`w-[70px] shrink-0 text-right text-[17px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums ${NAVY}`}>{pct(w.en)}<span className="text-[11px]">%</span></span>
                    <span className="flex-1 h-1.5 rounded-full bg-subtle overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct(w.en))}%`, background: hit(w.en) ? GREEN : AMBER_BAR }} />
                    </span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  )
}

export default function PublishingEnglishDesignCheck() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-10">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">English apart from the total</h1>
          <p className="mt-1.5 text-muted leading-relaxed max-w-[720px] m-0">
            Real figures from the snapshot, at the card&rsquo;s real half-screen width. English is 2 of
            AskAnAdventistFriend&rsquo;s 11 weekly target and was missed in three of these four weeks while the
            total read 82%, 27%, 136% and 82%. That is the miss these layouts have to make visible.
          </p>
        </div>
        <VariantA />
        <VariantB />
        <VariantC />
      </div>
    </div>
  )
}
