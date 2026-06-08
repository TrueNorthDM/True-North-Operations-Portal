/** NavCard — a large clickable card linking to a section. Used by the Home and
 *  Dashboards landing pages. Plain <a> so it works for both app routes and the
 *  static /boards.html. */
export function NavCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md"
    >
      <h2 className="text-xl font-bold text-slate-900 transition-colors group-hover:text-slate-700">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
        Open <span aria-hidden="true">→</span>
      </span>
    </a>
  )
}
