// Home — the portal's launcher. Links to the top-level pillars; Admin shows
// only for portal admins.

import { NavCard } from '@/components/NavCard'
import { isCurrentUserAdmin } from '@/lib/auth/role'

export default async function HomePage() {
  const isAdmin = await isCurrentUserAdmin()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">True North Operations Portal</h1>
        <p className="mt-1 text-slate-500">Where would you like to go?</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <NavCard
          href="/dashboards"
          title="Dashboards"
          description="Boards Review — editorial pipeline & weekly publishing goals."
        />
        <NavCard
          href="/projects"
          title="Projects"
          description="Your workspaces — AAAF & HFA."
        />
        <NavCard
          href="/tools"
          title="Tools"
          description="Capabilities you use inside a project, like Href Link Management."
        />
        {isAdmin && (
          <NavCard
            href="/admin"
            title="Admin"
            description="People, teams, and who can access what."
          />
        )}
      </div>
    </div>
  )
}
