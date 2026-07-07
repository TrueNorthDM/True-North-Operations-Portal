// Applies the saved theme (or the system preference on first visit) BEFORE
// first paint, so there's no light flash when the user prefers dark. Loaded
// as a blocking script at the top of <body> (see app/layout.tsx).
try {
  // The print/PDF route is always light — a client report must never inherit
  // the portal's dark theme (dark bg + light text prints as a blank page when
  // the browser drops backgrounds).
  var isPrint = location.pathname === '/tools/time-report/print'
  var t = localStorage.getItem('tn:theme')
  if (!isPrint && (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches))) {
    document.documentElement.classList.add('dark')
  }
} catch (e) { /* storage unavailable — stay light */ }
