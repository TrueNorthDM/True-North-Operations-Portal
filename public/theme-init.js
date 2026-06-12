// Applies the saved theme (or the system preference on first visit) BEFORE
// first paint, so there's no light flash when the user prefers dark. Loaded
// as a blocking script at the top of <body> (see app/layout.tsx).
try {
  var t = localStorage.getItem('tn:theme')
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch (e) { /* storage unavailable — stay light */ }
