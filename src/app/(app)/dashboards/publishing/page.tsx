/**
 * Publishing Goals, the legacy COE dashboard (public/boards.html) wrapped in
 * the portal shell so it keeps the top bar + sidebar.
 *
 * boards.html is a static file served from /public, OUTSIDE the React tree, so
 * on its own it has no app chrome and no way back home. Framing it inside this
 * (app) route is the lightest way to give it both menus without rewriting it
 * (the native React rewrite lives at /boards-beta). Same-origin → the session
 * cookie flows, so the auth-gated page loads inside the frame.
 */

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export default async function PublishingDashboardPage() {
  // Same pair as the card that leads here: the area from the access level, the
  // tool from the team. /dashboards was guarded but this child was not, so the
  // parent's guard was bypassed by typing the URL.
  const access = await requireSurface('tools')
  if (!access.canTool('publishing')) redirect('/tools')

  // MainContent gives this route a full-height, edge-to-edge wrapper, so the
  // iframe fills the entire content area, no padding, border, or viewport math.
  return (
    <iframe
      src="/boards.html"
      title="Publishing Goals, Boards Review"
      className="block h-full w-full border-0"
    />
  )
}
