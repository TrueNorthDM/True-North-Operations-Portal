/**
 * What an Href Links page shows when its data could not be read (audit,
 * 10 October 2026): a failed read used to crash the page or show an empty
 * list, which reads as "no pages". The reason stays in the server log.
 */

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ROUTES } from '@/lib/nav/routes'

export const READ_ERROR = 'Href Links could not be read just now. Try again in a moment.'

export function HrefLinksReadError({ now }: { now?: string }) {
  return (
    <div className="space-y-6">
      {now ? <Breadcrumb parents={[ROUTES.hrefLinks]} now={now} /> : <Breadcrumb self={ROUTES.hrefLinks} />}
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        {READ_ERROR}
      </div>
    </div>
  )
}
