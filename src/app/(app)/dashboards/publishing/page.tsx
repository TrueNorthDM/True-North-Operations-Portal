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
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/" className="hover:text-slate-800">Dashboard</a>
        <span>/</span>
        <a href="/dashboards" className="hover:text-slate-800">Dashboards</a>
        <span>/</span>
        <span>Publishing Goals</span>
      </div>
      <iframe
        src="/boards.html"
        title="Publishing Goals — Boards Review"
        className="w-full h-[calc(100vh-11rem)] min-h-[600px] rounded-xl border border-slate-200 bg-white"
      />
    </div>
  )
}
