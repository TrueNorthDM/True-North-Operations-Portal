/**
 * What a page looks like before its data arrives.
 *
 * Shown by the loading.tsx files under (app) the instant a link is clicked. Every
 * page in the portal is rendered on request, and until September 2026 not one of
 * them had a loading state, so a click did nothing visible until the server had
 * finished: the Next.js guide describes exactly that as giving "the impression
 * that the app is not responding". With a loading.tsx the router can also
 * prefetch this shell ahead of the click.
 *
 * Shaped like the pages rather than like a spinner: a trail, a title, a line of
 * description, a row of controls, then a panel. The eye lands where the content
 * will be, so nothing jumps when it arrives.
 *
 * Only for a change of page. Changing a filter on the same page keeps the current
 * page on screen while the new data loads, which was measured on this version of
 * Next.js before these files were added: a report does not blank out to a skeleton
 * every time somebody picks a month.
 */

// A navy tint, not the subtle fill. --subtle is #f4f2ec and the page behind it is
// #f1efe8, so bars drawn in it vanished everywhere except inside the white panel.
// The tint reads on both grounds, and it is the same navy the portal already uses
// for its quiet fills.
const bar = 'rounded-md bg-[rgba(1,35,88,0.08)] motion-safe:animate-pulse'

export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading</span>

      <div className="space-y-3" aria-hidden="true">
        <div className={`${bar} h-3.5 w-64 max-w-full`} />
        <div className={`${bar} h-8 w-80 max-w-full`} />
        <div className={`${bar} h-4 w-[36rem] max-w-full`} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5" aria-hidden="true">
        <div className={`${bar} h-10 w-40`} />
        <div className={`${bar} h-10 w-32`} />
        <div className="ml-auto flex gap-2.5">
          <div className={`${bar} h-10 w-28`} />
          <div className={`${bar} h-10 w-28`} />
        </div>
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-white p-5 space-y-4" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4">
            <div className={`${bar} h-4 w-1/4`} />
            <div className={`${bar} h-4 flex-1`} />
            <div className={`${bar} h-4 w-20`} />
          </div>
        ))}
      </div>
    </div>
  )
}
