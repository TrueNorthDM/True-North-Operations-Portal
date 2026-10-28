// Makes the Google Doc "Translation Table" tab from src/lib/timeclock/structure-2026.ts and the inventory of hours.
// node translation-to-doc.mjs <repo root> <inventory.tsv> <out.html>
import { readFileSync, writeFileSync } from 'node:fs'
import { buildSync } from 'esbuild'
const [, , root, inv, out] = process.argv
const js = buildSync({ entryPoints: [`${root}/src/lib/timeclock/structure-2026.ts`], bundle: true, format: 'esm', write: false, platform: 'node' }).outputFiles[0].text
const S = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const hours = { JOB: new Map(), OPT: new Map() }
for (const line of readFileSync(inv, 'utf8').split('\n')) {
  const c = line.split('\t')
  if (c[0] === 'JOB') hours.JOB.set(c[1], c[4] || '')
  if (c[0] === 'OPT') hours.OPT.set(`${c[1]}|${c[2]}`, c[4] || '')
}
const h = (field, v) => { const x = hours.OPT.get(`${field}|${v}`); return x ? Number(x).toLocaleString('en-US') : '0' }
const hj = v => { const x = hours.JOB.get(v); return x ? Number(x).toLocaleString('en-US') : '0' }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const F = 'font-family:Arial,sans-serif;'
const C = { ink: '#012358', body: '#435066', muted: '#8593a4', teal: '#1E7D7F', green: '#0d7a4f', amber: '#8a6d1a', red: '#c8323d', line: '#d9dee5', head: '#eaf4f4' }
const SURE = { same: [C.green, 'Same'], closest: [C.amber, 'Closest'], check: [C.red, 'To confirm'], none: [C.muted, 'No new home'] }
const th = (t, w) => `<th style="${F}width:${w};background:${C.head};color:${C.ink};font-size:9.5pt;font-weight:bold;text-align:left;padding:5pt 6pt;border:1px solid ${C.line}">${t}</th>`
const td = (t, w) => `<td style="${F}width:${w};vertical-align:top;font-size:9.5pt;color:${C.body};padding:5pt 6pt;border:1px solid ${C.line}">${t}</td>`
const table = (heads, rows) => `<table style="border-collapse:collapse;width:100%;table-layout:fixed"><thead><tr>${heads.map(([x, w]) => th(x, w)).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
const h1 = t => `<h1 style="${F}color:${C.ink};font-size:20pt">${esc(t)}</h1>`
const h2 = t => `<h2 style="${F}color:${C.teal};font-size:14pt;margin-top:18pt">${esc(t)}</h2>`
const h3 = t => `<h3 style="${F}color:${C.ink};font-size:12pt;margin-top:12pt">${esc(t)}</h3>`
const para = t => `<p style="${F}color:${C.body};font-size:10.5pt">${t}</p>`
const li = t => `<li style="${F}color:${C.body};font-size:10.5pt">${t}</li>`
const to = t => t.to == null ? '<span style="color:#8593a4">(stays its own row in history)</span>' : typeof t.to === 'string' ? esc(t.to) : esc(S.placeText(t.to))
const sure = t => `<b style="color:${SURE[t.sure][0]}">${SURE[t.sure][1]}</b>`
const W = ['24%', '9%', '30%', '11%', '26%']
const tr = (old, hrs, t) => `<tr>${td(`<b style="color:${C.ink}">${esc(old)}</b>`, W[0])}${td(hrs, W[1])}${td(to(t), W[2])}${td(sure(t), W[3])}${td(esc(t.why ?? ''), W[4])}</tr>`
const HEAD = [['Old value', W[0]], ['Hours 2026', W[1]], ['New', W[2]], ['How sure', W[3]], ['Why', W[4]]]

let o = h1('Translation table: TSheets structure to the 2026 structure')
o += para('For Tina and David to review. On the left, every value people pick in TSheets today, with the hours it had in 2026 (portal copy up to October 9). On the right, where it goes in the new structure.')
o += para('<b>What this table is for:</b> it only puts report rows from before and after the switch date side by side (for example, old project "AAAF" and new project AAAF). It never changes an old entry: the history keeps the old structure for good.')
o += para('<b>How sure:</b> <b style="color:#0d7a4f">Same</b> = the same thing under a new name or place. <b style="color:#8a6d1a">Closest</b> = the nearest new value, good for reports. <b style="color:#c8323d">To confirm</b> = please confirm or correct. <b style="color:#8593a4">No new home</b> = stays its own row in history.')
o += para('<b>To comment:</b> add a Google Docs comment on the row. Claude reads the comments and updates the table.')

const checks = [...S.OLD_JOBS, ...S.OLD_PROJECTS, ...S.OLD_ACTIVITIES, ...S.OLD_TASKS].filter(t => t.sure === 'check')
o += h2(`To confirm (${checks.length})`)
o += `<ul>${checks.map(t => li(`<b>${esc(t.old)}</b>: ${esc(t.why)}`)).join('')}</ul>`

o += h2('1. The new structure')
for (const c of S.STRUCTURE) {
  o += h3(`${c.name} (${c.billable ? 'billable' : 'not billable'})`)
  if (c.divisions.length) o += `<ul>${c.divisions.map(d => li(`<b>${esc(d.name)}</b>: ${d.projects.map(p => esc(p.name)).join(', ')}`)).join('')}</ul>`
  if (c.projects.length) o += `<ul>${c.projects.map(p => li(esc(p.name))).join('')}</ul>`
}
o += para('Time off (Vacation, Sick, Holiday, Jury duty, Rwanda-Incidental) stays outside the structure, as today.')
o += h3('The 26 activities')
o += `<ul>${S.ACTIVITY_FAMILIES.map(f => li(`<b>${esc(f)}</b>: ${S.ACTIVITIES.filter(a => a.family === f).map(a => esc(a.name) + (a.notesRequired ? ' (Notes required)' : '')).join(', ')}`)).join('')}</ul>`

o += h2('2. Clients (old field "1 Company")')
o += table(HEAD, S.OLD_COMPANIES.map(t => tr(t.old, h('1 Company', t.old), t)))
o += h2('3. Top-level jobs')
o += table(HEAD, S.OLD_JOBS.map(t => tr(t.old, hj(t.old), t)))
o += h2('4. Projects (old field "2 Project")')
o += table(HEAD, S.OLD_PROJECTS.map(t => tr(t.old, h('2 Project', t.old), t)))
o += h2('5. i7 codes (old field "1 - i7 Code")')
o += para('Each code becomes the project of the same name, under the division that is its block in the i7 report.')
const i7 = [...hours.OPT.keys()].filter(k => k.startsWith('1 - i7 Code|')).map(k => k.split('|')[1])
o += table(HEAD, i7.map(code => tr(code, h('1 - i7 Code', code), S.oldI7Code(code))))
o += h2('6. Activities (old field "3 Activity")')
o += table(HEAD, S.OLD_ACTIVITIES.map(t => tr(t.old, h('3 Activity', t.old), t)))
o += h2('7. Tasks (old field "Tasks", ends on the switch date)')
o += table(HEAD, S.OLD_TASKS.map(t => tr(t.old, h('Tasks', t.old), t)))
o += h2('8. Billable (old field "4 Billable")')
o += para('Before the switch date, the yes/no each entry was given is kept. From the switch date Billable comes from the project: i7 Marketing and COE Group yes, True North Internal no. The "50%" option is retired (not used in 2026).')
writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><title>Translation table (for the Google Doc)</title></head><body style="max-width:900px;margin:24px auto;padding:0 16px">${o}</body></html>`)
console.log('checks', checks.length)
