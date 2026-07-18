// Animated "sunrise" / north-star — counter-rotating gold ray layers, expanding
// rings, a breathing glow, and a pulsing gold core, all anchored on one point.
// Pure CSS, guarded by prefers-reduced-motion via .tn-anim. Shared by the login
// brand panel and the Home welcome banner (the anchor is configurable so each
// surface can place the sun where it looks best). Sits inside a `relative`,
// `overflow-hidden` container on a navy background.

export function Sunrise({
  anchorLeft = '50%',
  anchorTop = 60,
  glowAt = '50% 8%',
}: { anchorLeft?: string; anchorTop?: number; glowAt?: string }) {
  return (
    <>
      {/* concentric elements anchored on the sun's centre */}
      <div className="pointer-events-none absolute h-0 w-0" style={{ left: anchorLeft, top: anchorTop }}>
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
        style={{ background: `radial-gradient(circle at ${glowAt}, rgba(242,196,10,.26), transparent 46%)`, transformOrigin: glowAt, animation: 'tn-breathe 6.5s ease-in-out infinite' }}
      />
    </>
  )
}
