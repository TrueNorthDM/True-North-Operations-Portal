// Makes the Google Doc "Transition Plan" tab from the plan artifact's own content, so the two stay identical.
// node plan-to-doc.mjs <plan.html> <out.html>
import { readFileSync, writeFileSync } from 'node:fs'
const [, , src, out] = process.argv
const html = readFileSync(src, 'utf8')
const data = JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1])
const js = html.match(/<script id="app-js">([\s\S]*?)\/\/ ── Rendering/)[1]
const { DOC_URL, INTRO, PHASES, CONCEPTS, DECISIONS } = new Function(`${js}; return { DOC_URL, INTRO, PHASES, CONCEPTS, DECISIONS }`)()
const done = new Set(data.done), wip = new Set(data.wip)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const F = "font-family:Arial,sans-serif;"
const C = { ink: '#012358', body: '#435066', muted: '#8593a4', teal: '#1E7D7F', green: '#0d7a4f', amber: '#8a6d1a', red: '#c8323d', line: '#d9dee5', head: '#eaf4f4' }
const th = (t, w) => `<th style="${F}width:${w};background:${C.head};color:${C.ink};font-size:9.5pt;font-weight:bold;text-align:left;padding:5pt 6pt;border:1px solid ${C.line}">${t}</th>`
const td = (t, w, extra = '') => `<td style="${F}width:${w};vertical-align:top;font-size:9.5pt;color:${C.body};padding:5pt 6pt;border:1px solid ${C.line};${extra}">${t}</td>`
const table = (heads, rows) => `<table style="border-collapse:collapse;width:100%;table-layout:fixed"><colgroup>${heads.map(([, w]) => `<col style="width:${w}">`).join('')}</colgroup><thead><tr>${heads.map(([h, w]) => th(h, w)).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
const h1 = t => `<h1 style="${F}color:${C.ink};font-size:20pt">${esc(t)}</h1>`
const h2 = t => `<h2 style="${F}color:${C.teal};font-size:14pt;margin-top:18pt">${esc(t)}</h2>`
const h3 = t => `<h3 style="${F}color:${C.ink};font-size:12pt;margin-top:12pt">${esc(t)}</h3>`
const p = (t, extra = '') => `<p style="${F}color:${C.body};font-size:10.5pt;${extra}">${t}</p>`
const all = PHASES.flatMap(x => x.items)
const n = all.filter(i => done.has(i[0])).length
const W = ['13%', '25%', '40%', '12%', '10%']
const status = (id, ph) => done.has(id) ? `<b style="color:${C.green}">Done</b>` : wip.has(id) ? `<b style="color:${C.amber}">In progress</b>` : ph === 'decide' ? `<b style="color:${C.red}">To decide</b>` : `<span style="color:${C.muted}">Open</span>`
let o = h1('North Time launch plan')
o += p(esc(INTRO))
o += p(`<b style="color:${C.ink}">Progress: ${n} of ${all.length} done (${Math.round(n / all.length * 100)}%).</b> This tab is the same content as the North Time Launch Plan (Claude artifact). The plan is the master; Claude updates both together.`)
o += h2('The plan')
for (const ph of PHASES) {
  const d = ph.items.filter(i => done.has(i[0])).length
  o += h3(`${ph.title} (${ph.when}) · ${d} of ${ph.items.length} done`)
  o += p(esc(ph.why), `color:${C.muted};font-size:9.5pt`)
  o += table([['Status', W[0]], ['Item', W[1]], ['Explanation', W[2]], ['Who', W[3]], ['By', W[4]]], ph.items.map(([id, t, d2, who, due]) => {
    const isDone = done.has(id)
    return `<tr>${td(status(id, ph.id), W[0])}${td(`<b style="color:${isDone ? C.muted : C.ink};${isDone ? 'text-decoration:line-through' : ''}">${esc(t)}</b>`, W[1])}${td(esc(d2), W[2])}${td(esc(who), W[3])}${td(esc(due), W[4])}</tr>`
  }))
}
o += h2('How the transition works')
for (const c of CONCEPTS) {
  o += h3(c.title)
  for (const b of c.body) o += Array.isArray(b) ? `<ul>${b.map(li => `<li style="${F}color:${C.body};font-size:10.5pt">${esc(li)}</li>`).join('')}</ul>` : p(esc(b))
}
o += h2(`Decisions log (${DECISIONS.length} decisions)`)
const DW = ['10%', '25%', '53%', '12%']
o += table([['Date', DW[0]], ['Decision', DW[1]], ['What and why', DW[2]], ['Who', DW[3]]], DECISIONS.map(([date, t, d, who]) => `<tr>${td(`<b style="color:${C.teal}">${esc(date)}</b>`, DW[0])}${td(`<b style="color:${C.ink}">${esc(t)}</b>`, DW[1])}${td(esc(d), DW[2])}${td(esc(who), DW[3])}</tr>`))
writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><title>Transition Plan (for the Google Doc)</title></head><body style="max-width:900px;margin:24px auto;padding:0 16px">${o}</body></html>`)
console.log(`${n}/${all.length} done, ${PHASES.length} blocks, ${CONCEPTS.length} concepts, ${DECISIONS.length} decisions`)
