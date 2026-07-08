import Link from 'next/link'

/** NavCard — a large clickable card linking to a section. Used by the Home and
 *  Dashboards landing pages. Uses next/link for in-app routes (client-side nav),
 *  but falls back to a plain <a> for static files (e.g. /boards.html) or
 *  external URLs, so the "works for both" contract is preserved. */
export function NavCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  const isInApp = href.startsWith('/') && !href.endsWith('.html')
  const className = 'group rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md'
  const inner = (
    <>
      <h2 className="text-xl font-bold text-slate-900 transition-colors group-hover:text-slate-700">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
        Open <span aria-hidden="true">→</span>
      </span>
    </>
  )
  return isInApp ? (
    <Link href={href} className={className}>{inner}</Link>
  ) : (
    <a href={href} className={className}>{inner}</a>
  )
}
