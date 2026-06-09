// Tools — hub of capabilities. Tools run inside a project (e.g. Href Link
// Management operates on a project's hreflang tags), so each one is entered by
// opening a project. More tools land here as the portal grows.

import { NavCard } from '@/components/NavCard'

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tools</h1>
        <p className="mt-1 text-slate-500">Capabilities you use inside a project.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NavCard
          href="/projects"
          title="Href Link Management"
          description="Manage hreflang tags for a project's WordPress pages. Open a project (AAAF or HFA) to use it."
        />

        {/* Placeholder — signals the section is extensible without a dead link. */}
        <div
          className="rounded-xl border-2 border-dashed border-slate-200 bg-transparent p-6 opacity-60"
          aria-hidden="true"
        >
          <h2 className="text-xl font-bold text-slate-400">More tools coming</h2>
          <p className="mt-1.5 text-sm text-slate-400">
            New capabilities will appear here as the portal grows.
          </p>
        </div>
      </div>
    </div>
  )
}
