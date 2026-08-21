// Applies the saved theme (or the system preference on first visit) BEFORE
// first paint, so there's no light flash when the user prefers dark. Loaded
// as a blocking script at the top of <body> (see app/layout.tsx).
try {
  // The print/PDF routes are always light. A report must never inherit the
  // portal's dark theme: dark background plus light text prints as a blank
  // page the moment the browser drops backgrounds, and the PDF route
  // photographs whatever this page decides.
  var isPrint = location.pathname === '/tools/time-report/print'
    || location.pathname === '/report/print'
  var t = localStorage.getItem('tn:theme')
  if (!isPrint && (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches))) {
    document.documentElement.classList.add('dark')
  }
} catch (e) { /* storage unavailable — stay light */ }
