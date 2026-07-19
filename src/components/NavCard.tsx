import Link from 'next/link'

/** NavCard: a large clickable card linking to a section. Used by the Home and
 *  Dashboards landing pages. Uses next/link for in-app routes (client-side nav),
 *  but falls back to a plain <a> for static files (e.g. /boards.html) or
 *  external URLs, so the "works for both" contract is preserved. */
export function NavCard({
  href,
  title,
  description,
  icon,
  soon = false,
}: {
  href: string
  title: string
  description: string
  icon?: React.ReactNode
  soon?: boolean
}) {
  // "Soon", a not-ready section: dashed border, muted, a Soon pill, no link
  // (matches the Home placeholder widgets).
  if (soon) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-6" aria-disabled="true">
        <div className="flex items-start justify-between gap-2">
          {icon && (
            <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              {icon}
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
            Soon
          </span>
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-slate-400">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-400">{description}</p>
      </div>
    )
  }

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
