/**
 * The System manual's Href Links pictures (owner, 4 November 2026: the
 * guides show the real screens with made-up data). The pages and their links
 * are invented; the site, its domain and its languages are AAAF's.
 */

import type { ActivityRow, PageListRow } from '@/lib/href-links/data'

export const HREF_LANGUAGES = ['en', 'pt', 'es', 'sw']
export const HREF_DOMAIN = 'https://www.askanadventistfriend.com'
const SITE = 'https://www.askanadventistfriend.com'

const status = (urls: string[], live: string[]) =>
  Object.fromEntries(HREF_LANGUAGES.map(l => [l, { hasUrl: urls.includes(l), confirmed: live.includes(l) }]))

export const hrefRows: PageListRow[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'How to Read the Bible Daily', langStatus: status(HREF_LANGUAGES, ['en']), done: false },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Finding Rest on the Sabbath', langStatus: status(HREF_LANGUAGES, []), done: false },
  { id: '00000000-0000-4000-8000-000000000003', name: 'What Is Prayer?', langStatus: status(['en', 'pt'], []), done: false },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Hope in Hard Times', langStatus: status(['en', 'es'], []), done: false },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Healthy Living Tips', langStatus: status(HREF_LANGUAGES, HREF_LANGUAGES), confirmedDoneAt: '2026-10-21T15:00:00Z', done: true },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Meet the Team', langStatus: status(['en'], ['en']), notRelevant: true, done: true },
]

/** One page, "How to Read the Bible Daily": every link saved, English live. */
export const hrefPage = {
  pageId: hrefRows[0].id,
  pageName: hrefRows[0].name,
  savedUrls: [
    { language_code: 'en', url: `${SITE}/how-to-read-the-bible-daily/` },
    { language_code: 'pt', url: `${SITE}/pt/como-ler-a-biblia-diariamente/` },
    { language_code: 'es', url: `${SITE}/es/como-leer-la-biblia-a-diario/` },
    { language_code: 'sw', url: `${SITE}/sw/jinsi-ya-kusoma-biblia-kila-siku/` },
  ],
  confirmations: [
    { language_code: 'en', confirmed_on_live: true },
    { language_code: 'pt', confirmed_on_live: false },
    { language_code: 'es', confirmed_on_live: false },
    { language_code: 'sw', confirmed_on_live: false },
  ],
}

/** The site's recent Monday activity, newest first, in the handlers' own words. */
export const hrefActivity: ActivityRow[] = [
  { id: 'a1', received_at: '2026-11-03T16:40:00Z', monday_item_id: '1', page_name: 'How to Read the Bible Daily', result: 'ok:confirmed en (all-live=false)' },
  { id: 'a2', received_at: '2026-11-03T14:05:00Z', monday_item_id: '2', page_name: 'How to Read the Bible Daily', result: 'ok:applied Apply Link to 4 sibling items' },
  { id: 'a3', received_at: '2026-11-03T14:04:00Z', monday_item_id: '3', page_name: 'How to Read the Bible Daily', result: 'ok:saved sw' },
  { id: 'a4', received_at: '2026-11-02T18:30:00Z', monday_item_id: '4', page_name: 'What Is Prayer?', result: 'ok:saved pt (waiting on: es,sw)' },
]
