// Login — split brand panel (handoff option 1a). Server Component shell; the
// form (client) is LoginForm. Left panel = navy gradient + animated "sunrise"
// (pure CSS, guarded by prefers-reduced-motion); right = logo + magic-link form.

import { Suspense } from 'react'
import Image from 'next/image'
import { LoginForm } from '@/components/LoginForm'
import { ThemeToggle } from '@/components/ThemeToggle'

// The animated north-star / sunrise: counter-rotating gold ray layers, expanding
// rings, a breathing glow, and a pulsing gold core — all centered on one point.
function Sunrise() {
  return (
    <>
      {/* concentric elements anchored on the sun's centre (top-centre of panel) */}
      <div className="pointer-events-none absolute left-1/2 top-[60px] h-0 w-0">
        <div
          className="tn-anim"
          style={{ position: 'absolute', left: -330, top: -330, width: 660, height: 660, borderRadius: '50%', background: 'repeating-conic-gradient(from 0deg, rgba(242,196,10,.13) 0deg 1.6deg, transparent 1.6deg 15deg)', WebkitMaskImage: 'radial-gradient(circle, transparent 26%, #000 40%, transparent 74%)', maskImage: 'radial-gradient(circle, transparent 26%, #000 40%, transparent 74%)', animation: 'tn-spin 80s linear infinite' }}
        />
        <div
          className="tn-anim"
          style={{ position: 'absolute', left: -260, top: -260, width: 520, height: 520, borderRadius: '50%', background: 'repeating-conic-gradient(from 4deg, rgba(148,196,197,.10) 0deg 1deg, transparent 1deg 9deg)', WebkitMaskImage: 'radial-gradient(circle, transparent 34%, #000 48%, transparent 78%)', maskImage: 'radial-gradient(circle, transparent 34%, #000 48%, transparent 78%)', animation: 'tn-spin-rev 120s linear infinite' }}
        />
        {[0, 1.8, 3.6].map((delay, i) => (
          <div
            key={i}
            className="tn-anim"
            style={{ position: 'absolute', left: -270, top: -270, width: 540, height: 540, borderRadius: '50%', border: `1px solid ${i === 1 ? 'rgba(242,196,10,.4)' : 'rgba(148,196,197,.5)'}`, animation: `tn-ripple 5.4s ease-out infinite`, animationDelay: `${delay}s` }}
          />
        ))}
        <div
          className="tn-anim"
          style={{ position: 'absolute', left: 0, top: 0, width: 12, height: 12, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#F2C40A', boxShadow: '0 0 26px 6px rgba(242,196,10,.55)', animation: 'tn-core 6.5s ease-in-out infinite' }}
        />
      </div>
      <div
        className="tn-anim pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 8%, rgba(242,196,10,.26), transparent 46%)', transformOrigin: '50% 8%', animation: 'tn-breathe 6.5s ease-in-out infinite' }}
      />
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      {/* Theme toggle — the top-bar toggle only exists once signed in, so the
          login screen gets its own so you can switch before logging in. */}
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-[1120px] min-h-[620px] overflow-hidden rounded-[22px] bg-card shadow-[0_24px_60px_-24px_rgba(1,35,88,.30)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,.65)]">
        {/* Left brand panel — hidden on small screens */}
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

        {/* Right panel — logo + form */}
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
