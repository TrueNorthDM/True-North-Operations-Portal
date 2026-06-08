// Home — the portal's main landing page. Links to the two top-level areas.

import { NavCard } from '@/components/NavCard'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">True North Operations Portal</h1>
        <p className="mt-1 text-slate-500">Where would you like to go?</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NavCard
          href="/dashboards"
          title="Dashboards"
          description="Boards Review — editorial pipeline & weekly publishing goals."
        />
        <NavCard
          href="/projects"
          title="Projects"
          description="AAAF & HFA hreflang tag management."
        />
      </div>
    </div>
  )
}
