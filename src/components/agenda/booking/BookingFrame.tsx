/**
 * What every screen of the public booking page shares (the approved mockup,
 * section 4): the logo, the steps, the white card with the host on the left,
 * and the line under it. No portal shell: the people here have no login.
 */

import Image from 'next/image'

export const MAIN = 'p-[26px] flex flex-col gap-4 min-w-0'
export const H4 = 'm-0 font-(family-name:--font-display) font-black text-[18px] text-tn-ink'
export const BTN_MAIN = 'inline-flex items-center justify-center border-0 rounded-[12px] px-5 py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[14px] cursor-pointer no-underline hover:bg-[#0a2f6b] disabled:opacity-40 disabled:cursor-default'
export const LINK = 'self-start border-0 bg-transparent p-0 cursor-pointer font-bold text-[13px] text-tn-teal hover:underline disabled:opacity-50'

const STEPS: [number, string][] = [[1, 'Pick a time'], [2, 'Your details'], [3, 'Confirm your email'], [4, 'Booked']]

export function Steps({ at, onGo }: { at: number; onGo?: (n: 1 | 2) => void }) {
  return (
    <ol className="m-0 p-0 list-none flex flex-wrap items-center justify-center gap-2" aria-label="Steps">
      {STEPS.map(([n, l], i) => (
        <li key={n} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="w-[22px] h-0.5 rounded bg-[#d9dde3]" />}
          <button type="button" disabled={!onGo || n > 2 || n >= at} onClick={() => onGo?.(n as 1 | 2)} aria-current={n === at ? 'step' : undefined}
            className={`inline-flex items-center gap-2 border-0 rounded-full px-2.5 py-1.5 text-[13px] font-bold ${n === at ? 'bg-white text-tn-ink shadow-[0_2px_8px_rgba(1,35,88,.08)]' : n < at ? 'bg-transparent text-tn-teal cursor-pointer disabled:cursor-default' : 'bg-transparent text-muted'}`}>
            <b className={`w-[22px] h-[22px] rounded-full border-2 inline-flex items-center justify-center text-[11.5px] font-(family-name:--font-display) ${n === at ? 'border-tn-primary bg-tn-primary text-[#ffffff]' : n < at ? 'border-tn-teal bg-tn-teal text-[#ffffff]' : 'border-[#c3cad4]'}`}>{n}</b>
            {l}
          </button>
        </li>
      ))}
    </ol>
  )
}

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-none fill-none stroke-tn-teal" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)

export function HostSide({ name, initials, len, when }: { name: string; initials: string; len?: number; when?: string | null }) {
  return (
    <div className="border-b md:border-b-0 md:border-r border-[var(--panel-border)] px-6 py-[26px] flex flex-col gap-3.5">
      <div className="w-14 h-14 rounded-full bg-[#F2C40A] text-tn-ink font-(family-name:--font-display) font-black text-[19px] flex items-center justify-center">{initials}</div>
      <div>
        <h3 className="m-0 font-(family-name:--font-display) font-black text-[21px] text-tn-ink">{name}</h3>
        <div className="text-[13px] text-muted">True North Digital Marketing</div>
      </div>
      <div className="flex flex-col gap-[9px] text-[13.5px] text-foreground">
        {len != null && <div className="flex gap-[9px] items-center"><I d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2" /><b>{len} min</b></div>}
        <div className="flex gap-[9px] items-center"><I d="M3 6h12v12H3zM15 10l6-4v12l-6-4" /><span>Google Meet, link in the invitation</span></div>
        {when && <div className="flex gap-[9px] items-center"><I d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /><span>{when}</span></div>}
      </div>
    </div>
  )
}

export function Mark({ kind }: { kind: 'mail' | 'ok' | 'warn' }) {
  if (kind === 'ok') return <div className="w-11 h-11 rounded-full bg-[#e2f2ee] text-[#16695c] flex items-center justify-center text-[22px] font-black">✓</div>
  if (kind === 'warn') return <div className="w-11 h-11 rounded-full bg-[var(--warn-bg)] text-[#8a6703] flex items-center justify-center text-[22px] font-black">!</div>
  return (
    <div className="w-11 h-11 rounded-full bg-[#e8edf6] text-tn-ink flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg>
    </div>
  )
}

export function BookingFrame({ steps, children, after }: { steps?: React.ReactNode; children: React.ReactNode; after?: React.ReactNode }) {
  return (
    <main className="flex-1 bg-[#f4f2ec] px-4 py-6 flex flex-col items-center gap-4">
      <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-10 w-auto" />
      {steps}
      <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(1,35,88,.10)] w-full max-w-[980px] grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] md:min-h-[520px] overflow-hidden">
        {children}
      </div>
      <p className="m-0 text-[11.5px] text-muted">Powered by the True North Operations Portal</p>
      {after}
    </main>
  )
}
