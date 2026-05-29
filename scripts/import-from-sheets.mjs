#!/usr/bin/env node
/**
 * One-off import script: reads the parsed Sheets data and writes it to Supabase.
 *
 * Run with:
 *   node --env-file=.env.local scripts/import-from-sheets.mjs
 *
 * Idempotency note: this is NOT idempotent. It assumes pages don't already exist
 * (besides 'About Us (test page)' which it deletes first). Run once.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const data = JSON.parse(readFileSync(new URL('../scripts/sheets-data.json', import.meta.url), 'utf8'))

async function main() {
  // 1. Delete test page
  console.log('Deleting test page…')
  const { error: delErr } = await supabase.from('pages').delete().eq('name', 'About Us (test page)')
  if (delErr) throw delErr

  // 2. Resolve site IDs
  console.log('Fetching site IDs…')
  const { data: sites, error: siteErr } = await supabase.from('sites').select('id, code')
  if (siteErr) throw siteErr
  const siteId = Object.fromEntries(sites.map(s => [s.code, s.id]))
  console.log('Sites:', siteId)

  // 3. Import each site
  for (const siteCode of ['aaaf', 'hfa']) {
    const pages = data[siteCode]
    if (!pages?.length) continue
    console.log(`\n${siteCode.toUpperCase()}: importing ${pages.length} pages…`)

    // INSERT pages in chunks (PostgREST has request size limits)
    const CHUNK = 50
    const insertedAll = []
    for (let i = 0; i < pages.length; i += CHUNK) {
      const slice = pages.slice(i, i + CHUNK).map(p => ({
        site_id: siteId[siteCode],
        name: p.name,
        cluster: p.cluster ?? null,
        primary_keyword: p.primary_keyword ?? null,
      }))
      const { data: inserted, error } = await supabase.from('pages').insert(slice).select('id, name')
      if (error) { console.error(error); throw error }
      insertedAll.push(...inserted)
      process.stdout.write(`  pages ${insertedAll.length}/${pages.length}\r`)
    }
    console.log(`  pages ${insertedAll.length}/${pages.length} ✓`)

    const idByName = Object.fromEntries(insertedAll.map(r => [r.name, r.id]))

    // INSERT page_urls
    const urlRows = []
    const confRows = []
    for (const p of pages) {
      const pageId = idByName[p.name]
      if (!pageId) continue
      for (const [lang, url] of Object.entries(p.urls || {})) {
        if (url) urlRows.push({ page_id: pageId, language_code: lang, url })
      }
      for (const [lang, c] of Object.entries(p.confirms || {})) {
        const row = { page_id: pageId, language_code: lang }
        if (c.live) {
          row.confirmed_on_live = true
          row.confirmed_at = new Date().toISOString()
        }
        if (c.gsc) {
          row.indexed_in_gsc = true
          row.gsc_confirmed_at = new Date().toISOString()
        }
        if (c.live || c.gsc) confRows.push(row)
      }
    }
    for (let i = 0; i < urlRows.length; i += CHUNK) {
      const slice = urlRows.slice(i, i + CHUNK)
      const { error } = await supabase.from('page_urls').insert(slice)
      if (error) { console.error(error); throw error }
      process.stdout.write(`  urls ${Math.min(i+CHUNK, urlRows.length)}/${urlRows.length}\r`)
    }
    console.log(`  urls ${urlRows.length}/${urlRows.length} ✓`)

    for (let i = 0; i < confRows.length; i += CHUNK) {
      const slice = confRows.slice(i, i + CHUNK)
      const { error } = await supabase.from('confirmations').insert(slice)
      if (error) { console.error(error); throw error }
      process.stdout.write(`  confs ${Math.min(i+CHUNK, confRows.length)}/${confRows.length}\r`)
    }
    console.log(`  confs ${confRows.length}/${confRows.length} ✓`)
  }
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
