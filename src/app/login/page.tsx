// Login: split brand panel (handoff option 1a). Server Component shell; the
// form (client) is LoginForm. Left panel = navy gradient + animated "sunrise"
// (pure CSS, guarded by prefers-reduced-motion); right = logo + magic-link form.

import { Suspense } from 'react'
import Image from 'next/image'
import { LoginForm } from '@/components/LoginForm'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Sunrise } from '@/components/Sunrise'

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      {/* Theme toggle, the top-bar toggle only exists once signed in, so the
          login screen gets its own so you can switch before logging in. */}
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-[1120px] min-h-[620px] overflow-hidden rounded-[22px] bg-card shadow-[0_24px_60px_-24px_rgba(1,35,88,.30)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,.65)]">
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
            <span className="mb-9 inline-block rounded-lg dark:bg-[#ffffff] dark:p-2">
              <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-12 w-auto" />
            </span>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
