// The sign-in pages' frame (handoff option 1a): a navy brand panel with the
// animated sunrise on the left, the logo and a form on the right. Shared by
// /login and /auth/confirm.

import Image from 'next/image'
import Link from 'next/link'
import { Sunrise } from '@/components/Sunrise'

/** The sign-in pages' frame: the brand panel on the left, the logo and a form on the right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4 sm:p-6">
      <div className="flex w-full max-w-[1120px] min-h-[620px] overflow-hidden rounded-[22px] bg-card shadow-[0_24px_60px_-24px_rgba(1,35,88,.30)],0,0,.65)]">
        {/* Left brand panel, hidden on small screens */}
        <div
          className="relative hidden w-[480px] shrink-0 flex-col justify-end overflow-hidden p-12 text-white md:flex"
          style={{ background: 'linear-gradient(160deg, #012358, #0a2f63)' }}
        >
          <Sunrise />
          {/* Panel is navy in both themes → fixed literal colors, not tokens. */}
          <div className="relative">
            <div style={{ fontFamily: 'var(--font-raleway)', fontWeight: 900, letterSpacing: '.2em' }} className="text-[12px] text-[#94C4C5]">
              TRUE NORTH DIGITAL MARKETING
            </div>
            <h1 style={{ fontFamily: 'var(--font-raleway)', fontWeight: 900, fontSize: '52px', lineHeight: 1.04 }} className="mt-3 text-[#ffffff]">
              Operations Portal
            </h1>
            <p className="mt-5 max-w-[300px] text-[15.5px] leading-relaxed text-[#ffffff]/70">
              One home for the tools, dashboards, and tasks that keep your team moving every day.
            </p>
          </div>
        </div>

        {/* Right panel, logo + form */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-14 sm:px-14">
          <div className="w-full max-w-sm text-center">
            <span className="mb-9 inline-block rounded-lg">
              <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-12 w-auto" />
            </span>
            {children}
          </div>
        </div>
      </div>
      {/* The home page Google's review of the portal's sign-in reads: what the portal is, and its policies. */}
      <p className="m-0 max-w-[1120px] text-center text-[12px] text-muted leading-[1.6]">
        The True North Operations Portal is True North Digital Marketing&apos;s internal work tool: hours, time off, pay documents, reports and the team calendar.
        {' '}<Link href="/legal/privacy" className="font-bold text-tn-teal">Privacy policy</Link>{' · '}<Link href="/legal/terms" className="font-bold text-tn-teal">Terms of use</Link>
      </p>
    </div>
  )
}
