/**
 * The annual review's work that follows a step (design handoff, E3 to E5 and
 * B2): the approved PDF (printed from its own page, US Letter, every page),
 * its copy in Google Drive with the three statuses (waiting, saved, failed),
 * and the "is open" emails. Shared by the actions and the daily job.
 */

import { printSheet } from '@/lib/pdf/sheet-pdf'
import { printPass, PRINT_HEADER } from '@/lib/drive/print-token'
import { selfOrigin } from '@/lib/drive/copies'
import { pdfName, dueOf } from './rules'
import { loadHrSettings, loadReview, loadRoster, nameIn, rdb, type Cycle, type HrSettings, type Roster } from './data'
import { reviewPdfPath, storePdf, storedPdf, writeApprovedPdf } from './drive'
import { firstName, noticeOnce } from './notify'
import { reviewMails } from './emails'

const LETTER = { width: 816, landscape: false, allPages: true, letter: true, running: true }

/** The approved review as PDF bytes, printed from its print page with a one-review pass. */
export async function printReviewPdf(id: number): Promise<Uint8Array> {
  const target = new URL(`/api/cron/drive-print/review/${id}`, selfOrigin())
  const done = await printSheet(target, { [PRINT_HEADER]: printPass('review', id) }, LETTER)
  if (!done) throw new Error('The review could not be printed: its print page answered "not found".')
  return done.pdf
}

async function cycleOf(cycleId: number): Promise<Cycle | null> {
  return (await rdb().from('review_cycles').select('*').eq('id', cycleId).maybeSingle()).data as Cycle | null
}

/** After approval: make and keep the PDF, copy it to Drive, tell the person and HR. Never throws. */
export async function approveReviewWork(id: number, roster: Roster, settings: HrSettings): Promise<void> {
  try {
    const r = await loadReview(id)
    if (!r || r.step !== 'approved') return
    const cycle = await cycleOf(r.cycle_id)
    if (!cycle) return
    const month = (cycle.started_at ?? cycle.leaders_open_on ?? `${cycle.year}-11-01`).slice(5, 7)
    const name = pdfName(cycle.year, month, nameIn(roster, r.person_id))
    try {
      const bytes = await printReviewPdf(id)
      await storePdf(reviewPdfPath(id), bytes)
      await rdb().from('reviews').update({ pdf_path: reviewPdfPath(id), pdf_name: name }).eq('id', id)
    } catch (e) {
      console.error('[review] pdf:', e instanceof Error ? e.message : e)
      await rdb().from('reviews').update({ pdf_name: name, drive_status: 'failed', drive_error: 'The PDF could not be made. Try again.' }).eq('id', id)
    }
    await copyReviewToDrive(id)
    const by = nameIn(roster, r.approved_by)
    await noticeOnce(`review:${id}:approved:person`, roster, r.person_id, o => reviewMails.approved({ year: cycle.year, who: nameIn(roster, r.person_id), by, url: `${o}/human-resources/reviews/${id}`, toHr: false }))
    if (settings.hrId && settings.hrId !== r.person_id) {
      await noticeOnce(`review:${id}:approved:hr`, roster, settings.hrId, o => reviewMails.approved({ year: cycle.year, who: nameIn(roster, r.person_id), by, url: `${o}/human-resources/reviews/${id}`, toHr: true }))
    }
  } catch (e) {
    console.error('[review] approve work:', e instanceof Error ? e.message : e)
  }
}

/** Copies the approved PDF to Drive (and makes it first, when it is missing). */
export async function copyReviewToDrive(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await loadReview(id)
  if (!r || r.step !== 'approved') return { ok: false, error: 'Only an approved review is copied to Drive.' }
  const cycle = await cycleOf(r.cycle_id)
  if (!cycle) return { ok: false, error: 'The review year is not there any more.' }
  try {
    let bytes = r.pdf_path ? await storedPdf(r.pdf_path) : null
    if (!bytes) {
      bytes = await printReviewPdf(id)
      await storePdf(reviewPdfPath(id), bytes)
      await rdb().from('reviews').update({ pdf_path: reviewPdfPath(id) }).eq('id', id)
    }
    const settings = await loadHrSettings()
    const roster = await loadRoster()
    const month = (cycle.started_at ?? `${cycle.year}-11-01`).slice(5, 7)
    const name = r.pdf_name ?? pdfName(cycle.year, month, nameIn(roster, r.person_id))
    // Development only: REVIEW_DRIVE_OFF=1 keeps a local test out of the company Drive; the review shows "Waiting".
    if (process.env.NODE_ENV !== 'production' && process.env.REVIEW_DRIVE_OFF === '1') {
      await rdb().from('reviews').update({ pdf_name: name }).eq('id', id)
      return { ok: true }
    }
    const fileId = await writeApprovedPdf({ name, year: cycle.year, bytes, fileId: r.drive_file_id, folderId: settings.driveFolderId })
    await rdb().from('reviews').update({ drive_status: 'saved', drive_file_id: fileId, drive_error: null, pdf_name: name }).eq('id', id)
    return { ok: true }
  } catch (e) {
    const why = e instanceof Error ? e.message : 'Drive did not answer.'
    console.error('[review] drive:', why)
    await rdb().from('reviews').update({ drive_status: 'failed', drive_error: why.slice(0, 500) }).eq('id', id)
    return { ok: false, error: why }
  }
}

/** "Your 2026 review is open", once per review. */
export async function sendOpenedNotices(cycle: Cycle, ids: number[]): Promise<void> {
  if (!ids.length) return
  const roster = await loadRoster()
  const rows = ((await rdb().from('reviews').select('id, person_id, phase').in('id', ids)).data ?? []) as { id: number; person_id: string; phase: 1 | 2 }[]
  for (const r of rows) {
    await noticeOnce(`review:${r.id}:opened`, roster, r.person_id, o => reviewMails.opened({
      first: firstName(nameIn(roster, r.person_id)), year: cycle.year, due: dueOf('self', r.phase, cycle), url: `${o}/human-resources/reviews/${r.id}`,
    }))
  }
}
