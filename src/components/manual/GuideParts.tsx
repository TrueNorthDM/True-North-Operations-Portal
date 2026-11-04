/**
 * The System manual's guide pieces (owner, 4 November 2026): the guide's
 * header, numbered steps, a picture and a tip. A picture holds the portal's
 * real components fed made-up data (lib/manual/samples); it is `inert`, so it
 * reads as a screenshot: nothing in it can be clicked, typed in or focused.
 */

import type { ReactNode } from 'react'

const DISPLAY = 'font-(family-name:--font-display)'

export function GuideHeader({ eyebrow, title, minutes, children }: { eyebrow: string; title: string; minutes?: number; children: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <div className={`${DISPLAY} font-extrabold text-[11px] uppercase tracking-[.09em] text-tn-teal`}>{eyebrow}{minutes ? ` · ${minutes} minutes` : ''}</div>
      <h2 className={`m-0 ${DISPLAY} font-black text-[28px] text-tn-ink leading-tight`}>{title}</h2>
      <div className="text-[15.5px] leading-[1.6] text-foreground">{children}</div>
    </header>
  )
}

export function Step({ n, title, children, picture }: { n: number; title: string; children: ReactNode; picture?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex gap-3.5 items-start">
        <span className={`flex-none w-[30px] h-[30px] rounded-full bg-tn-ink text-[#F2C40A] ${DISPLAY} font-black text-[14px] flex items-center justify-center`} aria-hidden="true">{n}</span>
        <div className="min-w-0 flex flex-col gap-1 pt-1">
          <h3 className={`m-0 ${DISPLAY} font-extrabold text-[17px] text-tn-ink`}><span className="sr-only">Step {n}: </span>{title}</h3>
          <div className="text-[14.5px] leading-[1.6] text-foreground flex flex-col gap-2">{children}</div>
        </div>
      </div>
      {picture && <div className="md:ml-11 min-w-0">{picture}</div>}
    </section>
  )
}

/** A picture of a real screen with made-up data. `height` crops a tall screen to what the step is about. */
export function Picture({ caption, children, height }: { caption: string; children: ReactNode; height?: number }) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="rounded-[16px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5 overflow-hidden relative" style={height ? { maxHeight: height } : undefined}>
        <div inert className="select-none">{children}</div>
        {height && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none" aria-hidden="true" />}
      </div>
      <figcaption className="text-[12.5px] text-muted">{caption} Example with made-up names.</figcaption>
    </figure>
  )
}

export function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex gap-3 items-start rounded-[12px] bg-tn-teal-soft px-4 py-3.5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-none mt-0.5 text-tn-teal" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      <p className="m-0 text-[14px] leading-[1.6] text-tn-ink"><strong>{title}</strong> {children}</p>
    </aside>
  )
}
