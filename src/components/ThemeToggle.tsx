'use client'

/**
 * ThemeToggle: sun/moon button in the top bar. Flips the `dark` class on
 * <html> and persists the choice to localStorage (read pre-paint by
 * /theme-init.js). The icon swap is pure CSS (`dark:` variants), so the
 * server-rendered markup never mismatches whatever theme the client applied.
 */

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const next = root.classList.toggle('dark') ? 'dark' : 'light'
    try {
      window.localStorage.setItem('tn:theme', next)
    } catch {
      /* storage unavailable, theme still applies for this page */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
    >
      {/* Moon: shown in light mode (“switch to dark”) */}
      <svg className="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      {/* Sun: shown in dark mode (“switch to light”) */}
      <svg className="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  )
}
