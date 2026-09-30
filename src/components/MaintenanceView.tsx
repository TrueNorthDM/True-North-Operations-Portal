// The page the old portal shows while the data moves to its own server
// (migration plan, step p6-freeze): in the sign-in pages' frame, no session
// needed. The proxy shows it for every page while MAINTENANCE_MODE is on.

import { AuthShell } from '@/components/AuthShell'

export function MaintenanceView({ newAddress }: {
  /** Where it will be (for example truenorthportal.online), without https://. */
  newAddress: string
}) {
  return (
    <AuthShell>
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#fdf6d8] border border-[#f2dc85] px-3 py-1 text-[12px] font-semibold text-[#6b5500]">
          <span className="h-2 w-2 rounded-full bg-[#e8a317] motion-safe:animate-pulse" aria-hidden="true" />
          Moving in progress
        </span>
      </div>
      <h2 className="mt-5 font-(family-name:--font-display) font-extrabold text-[28px] leading-tight text-tn-ink">
        We&rsquo;re moving to a new home
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The Operations Portal is paused while everything is copied to its new address, so nothing gets lost on the way.
      </p>
      <div className="mt-6 rounded-[14px] border border-slate-200 bg-background px-5 py-4 text-left">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-muted">New address</p>
        <p className="m-0 mt-1 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{newAddress}</p>
        <p className="m-0 mt-4 text-[12px] font-extrabold uppercase tracking-wide text-muted">When</p>
        <p className="m-0 mt-1 text-[15px] font-semibold text-tn-ink">Back in a couple of days.</p>
      </div>
      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        Nothing to do on your side. Once it&rsquo;s back, sign in at the new address with your GoodNews email, as usual.
      </p>
    </AuthShell>
  )
}
