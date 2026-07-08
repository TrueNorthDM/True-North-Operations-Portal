import Link from 'next/link'

/** NavCard — a large clickable card linking to a section. Used by the Home and
 *  Dashboards landing pages. Uses next/link for in-app routes (client-side nav),
 *  but falls back to a plain <a> for static files (e.g. /boards.html) or
 *  external URLs, so the "works for both" contract is preserved. */
export function NavCard({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon?: React.ReactNode
}) {
  const isInApp = href.startsWith('/') && !href.endsWith('.html')
  const className = 'group rounded-2xl border-2 border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-tn-teal hover:shadow-md'
  const inner = (
    <>
      {icon && (
        <span className="mb-4 inline-flex w-11 h-11 items-center justify-center rounded-xl bg-tn-teal-soft text-tn-teal">
          {icon}
        </span>
      )}
      <h2 className="text-xl font-extrabold text-tn-ink">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-tn-teal">
        Open <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </>
  )
  return isInApp ? (
    <Link href={href} className={className}>{inner}</Link>
  ) : (
    <a href={href} className={className}>{inner}</a>
  )
}
