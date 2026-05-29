// Cross-check sheets ↔ DB exhaustively.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const sheets = JSON.parse(readFileSync('/tmp/sheets_full.json', 'utf8'))

const { data: sitesRows } = await supabase.from('sites').select('id, code')
const siteId = Object.fromEntries(sitesRows.map(s => [s.code, s.id]))

// Pull entire DB for both sites in one pass
async function pullSite(code) {
  const { data } = await supabase.from('pages')
    .select('id, name, page_urls(language_code, url), confirmations(language_code, confirmed_on_live, indexed_in_gsc)')
    .eq('site_id', siteId[code])
  return data
}

const dbAaaf = await pullSite('aaaf')
const dbHfa = await pullSite('hfa')

// Index DB by name → {urls, confirms}
function indexDb(rows) {
  const m = new Map()
  for (const p of rows) {
    m.set(p.name, {
      urls: Object.fromEntries(p.page_urls.map(u => [u.language_code, u.url])),
      confirms: Object.fromEntries(p.confirmations.map(c => [c.language_code, c])),
    })
  }
  return m
}
const idxAaaf = indexDb(dbAaaf)
const idxHfa = indexDb(dbHfa)

console.log(`AAAF — sheet rows: ${sheets.aaaf.length}, DB pages: ${dbAaaf.length}`)
console.log(`HFA  — sheet rows: ${sheets.hfa.length}, DB pages: ${dbHfa.length}`)

const report = { missingPages: [], missingUrls: [], confirmMismatch: [], extraDbPages: [] }

function diffSite(code, sheetPages, dbIdx, skipLangs = []) {
  // Pages
  const sheetNames = new Set(sheetPages.map(p => p.name))
  for (const p of sheetPages) {
    if (!dbIdx.has(p.name)) {
      report.missingPages.push({ site: code, name: p.name })
      continue
    }
    const dbP = dbIdx.get(p.name)
    // URLs
    for (const [lang, url] of Object.entries(p.urls)) {
      if (skipLangs.includes(lang)) continue
      if (!url) continue
      if (dbP.urls[lang] !== url) {
        report.missingUrls.push({ site: code, name: p.name, lang, sheet: url, db: dbP.urls[lang] || '∅' })
      }
    }
    // Confirmations (compare TRUE flags)
    for (const [lang, c] of Object.entries(p.confirms || {})) {
      if (skipLangs.includes(lang)) continue
      const dbC = dbP.confirms[lang] || {}
      if (c.live === true && dbC.confirmed_on_live !== true)
        report.confirmMismatch.push({ site: code, name: p.name, lang, field: 'live', sheet: true, db: dbC.confirmed_on_live ?? null })
      if (c.gsc === true && dbC.indexed_in_gsc !== true)
        report.confirmMismatch.push({ site: code, name: p.name, lang, field: 'gsc', sheet: true, db: dbC.indexed_in_gsc ?? null })
    }
  }
  // Extra pages in DB not in sheet
  for (const name of dbIdx.keys()) {
    if (!sheetNames.has(name))
      report.extraDbPages.push({ site: code, name })
  }
}

diffSite('aaaf', sheets.aaaf, idxAaaf, [])
diffSite('hfa', sheets.hfa, idxHfa, ['fr'])  // FR intentionally skipped per user

console.log('\n=== AUDIT REPORT ===')
console.log(`Pages missing from DB: ${report.missingPages.length}`)
for (const x of report.missingPages.slice(0, 10)) console.log('  ', x.site, x.name)
console.log(`URL mismatches: ${report.missingUrls.length}`)
for (const x of report.missingUrls.slice(0, 10)) console.log('  ', x.site, x.lang, x.name, '\n     sheet:', x.sheet, '\n     db:   ', x.db)
console.log(`Confirmation mismatches (sheet=TRUE, db≠TRUE): ${report.confirmMismatch.length}`)
for (const x of report.confirmMismatch.slice(0, 10)) console.log('  ', x.site, x.lang, x.field, x.name)
console.log(`Extra DB pages not in sheet: ${report.extraDbPages.length}`)
for (const x of report.extraDbPages.slice(0, 10)) console.log('  ', x.site, x.name)
