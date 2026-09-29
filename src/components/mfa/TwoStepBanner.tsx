/**
 * The reminder on every portal page while someone's week to set up two-step
 * sign-in runs (plan step p4-2fa). The app layout shows it under the top bar;
 * it goes away the moment the app is set up, and after the week the setup
 * screen itself takes over.
 */

import Link from 'next/link'

export const SETUP_HREF = '/auth/two-step/setup'

/** A shield with a check: the icon every two-step entry point shares. */
export function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function TwoStepBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-[#f2dc85] bg-[#fdf6d8] px-4 sm:px-6 py-2.5 text-[13px] text-[#6b5500]">
      <span className="inline-flex items-center gap-2 text-center">
        <span className="text-[#b08a00] shrink-0"><ShieldIcon /></span>
        <span>
          Set up two-step sign-in: <strong>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</strong>. After that the portal asks for it before you can go on.
        </span>
      </span>
      <Link
        href={SETUP_HREF}
        className="inline-flex items-center gap-1.5 shrink-0 rounded-[8px] bg-tn-primary px-3 py-1.5 font-(family-name:--font-display) font-extrabold text-[12px] text-[#ffffff] hover:brightness-110 transition-all"
      >
        Set it up now
      </Link>
    </div>
  )
}
