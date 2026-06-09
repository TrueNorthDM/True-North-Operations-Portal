/**
 * Publishing Goals — the legacy COE dashboard (public/boards.html) wrapped in
 * the portal shell so it keeps the top bar + sidebar.
 *
 * boards.html is a static file served from /public, OUTSIDE the React tree, so
 * on its own it has no app chrome and no way back home. Framing it inside this
 * (app) route is the lightest way to give it both menus without rewriting it
 * (the native React rewrite lives at /boards-beta). Same-origin → the session
 * cookie flows, so the auth-gated page loads inside the frame.
 */

export default function PublishingDashboardPage() {
  // Full-height flex column: the breadcrumb takes its natural height and the
  // iframe fills the rest via flex-1. MainContent gives this route a full-height
  // wrapper, so there's no viewport calc — the frame always fits exactly.
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
        <a href="/" className="hover:text-slate-800">Dashboard</a>
        <span>/</span>
        <a href="/dashboards" className="hover:text-slate-800">Dashboards</a>
        <span>/</span>
        <span>Publishing Goals</span>
      </div>
      <iframe
        src="/boards.html"
        title="Publishing Goals — Boards Review"
        className="flex-1 min-h-0 w-full rounded-xl border border-slate-200 bg-white"
      />
    </div>
  )
}
