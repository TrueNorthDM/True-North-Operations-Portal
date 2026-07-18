// WelcomeBanner — the Home hero: a personalised greeting on the same navy
// brand panel + animated "sunrise" used on the login screen. Server component
// (no state); the animation is pure CSS and honours prefers-reduced-motion.
//
// The panel is navy in BOTH themes, so its text uses fixed literal colors
// (#ffffff), not tokens/`text-white` — those remap to dark under the dark theme.

import { Sunrise } from '@/components/Sunrise'

export function WelcomeBanner({ name }: { name: string | null }) {
  const first = name?.trim().split(/\s+/)[0] || null
  return (
    <section
      className="relative overflow-hidden rounded-2xl px-7 py-8 md:px-9 md:py-9 shadow-[0_12px_34px_-16px_rgba(1,35,88,.55)]"
      style={{ background: 'linear-gradient(160deg, #012358, #0a2f63)' }}
    >
      <Sunrise anchorLeft="86%" anchorTop={14} glowAt="86% 34%" />

      <div className="relative max-w-[620px]">
        <div className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.2em] text-[#94C4C5]">
          TRUE NORTH DIGITAL MARKETING
        </div>
        <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] md:text-[30px] leading-tight text-[#ffffff] mt-2">
          {first ? `Hello, ${first}` : 'Welcome back'}
        </h2>
        <p className="text-[15px] text-[#ffffff]/80 mt-1.5">Welcome back to the True North Operations Portal.</p>
        <p className="text-[13.5px] text-[#ffffff]/60 mt-1">Your tools, dashboards, and team — all in one place.</p>
      </div>
    </section>
  )
}
