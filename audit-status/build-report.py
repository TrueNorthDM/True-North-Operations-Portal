"""Builds report.html, the audit's Layer 3 (global report), from progress.json
plus the closing round below. Static: the page reads nothing at load time.
Run: python3 audit-status/build-report.py"""
import html, json, pathlib

HERE = pathlib.Path(__file__).parent
d = json.loads((HERE / 'progress.json').read_text())
e = lambda s: html.escape(str(s))

mods = d['modules']
layer1 = d['layers'][0]
found = sum(m.get('found') or 0 for m in mods)
fixed = sum(m.get('fixed') or 0 for m in mods) + len(layer1['items'])
decided = sum(m.get('decided') or 0 for m in mods)
migrations = sorted({*layer1.get('migrations', []), *(x for m in mods for x in m.get('migrations') or []), *d.get('closing_migrations', [])})
closing = d['closing']

THEMES = [
    ('Who sees what', 'Every page and every action decides on the server who may see or change it. The database refuses everything else: salaries, rates, personal contacts, Monday, Href Links, publishing and settings tables are closed to signed-in sessions and read only by the portal, after it has decided. A daily health check, "Database protections", fails the moment one of them opens again.'),
    ('Numbers you can trust', 'Reads that silently stopped at 1,000 rows are gone (the Report saw 2,442 hours out of 7,757). A failed read now says so instead of showing $0, zeros or an empty list. Invoice lines add up to the cent, shares add up to 100%, hours are counted per person, and weeks and days follow New York.'),
    ('Monday and the integrations', 'A bad Monday answer no longer empties a board, the change log and the board are written together, the webhook acts on what Monday says now and processes each delivery once, and 695 false events were moved to reserve tables. QuickBooks Time calls stop after 30 seconds instead of hanging.'),
    ('Watching itself', 'Health runs every 4 hours, including Monday events, the daily summary, publishing snapshot and the database protections, and a check that could not run counts as a failure. The Home banner and Automations read one health summary.'),
    ('One way of doing things', 'Portal dialogs instead of the browser\'s, dropdowns instead of native selects, actions that answer with a sentence instead of crashing, one CSV and month-name module, and lint clean.'),
]

def card(m):
    st = m['status']
    counts = '' if st == 'skipped' else f'<div class="counts"><span><b>{m.get("found",0)}</b> found</span><span><b>{m.get("fixed",0)}</b> fixed</span><span><b>{m.get("decided",0)}</b> decisions</span></div>'
    hl = ''.join(f'<li>{e(h)}</li>' for h in m.get('highlights', [])[:4])
    note = f'<p class="note">{e(m["note"])}</p>' if m.get('note') else ''
    return f'''<article class="card {st}"><div class="card-head"><h3><span class="num">{m["n"]:02d}</span>{e(m["title"])}</h3><span class="pill {st}">{"Done" if st=="done" else "Skipped"}</span></div>
{f'<ul class="hl">{hl}</ul>' if hl else ''}{note}{counts}</article>'''

rows = ''.join(f'<tr><td class="n">{e(c["n"])}</td><td>{e(c["what"])}</td><td><span class="pill {c["status"]}">{e(c["label"])}</span></td><td>{e(c["outcome"])}</td></tr>' for c in closing)
themes = ''.join(f'<article class="card"><h3>{e(t)}</h3><p class="body">{e(b)}</p></article>' for t, b in THEMES)
still = ''.join(f'<li>{e(s)}</li>' for s in d['still_open'])
nexts = ''.join(f'<li>{e(s)}</li>' for s in d['next_steps'])

page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Portal Audit Report</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:wght@700;800;900&family=Open+Sans:wght@400;600;700&display=swap">
<style>
:root{{color-scheme:light;--background:#f1efe8;--card:#fff;--panel-border:#e4e7ec;--foreground:#435066;--muted:#6b7889;--faint:#cbd2da;--navy:#012358;--gold:#F2C40A;--gold-bg:#fbf1cf;--gold-fg:#8a6703;--teal:#1E7D7F;--ok-bg:#e6f6ee;--ok-fg:#0d7a4f;--chip-bg:#f1f3f6;--chip-fg:#5b6b82;--display:"Raleway","Open Sans",system-ui,sans-serif;--sans:"Open Sans",system-ui,-apple-system,"Segoe UI",sans-serif}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--background);color:var(--foreground);font-family:var(--sans);font-size:15px;line-height:1.55}}
h1,h2,h3{{font-family:var(--display);color:var(--navy);margin:0;letter-spacing:-.015em;text-wrap:balance}}
.wrap{{max-width:1080px;margin:0 auto;padding:28px 16px 64px;display:grid;gap:18px}}
.band{{background:var(--navy);border-radius:18px;padding:26px;color:#fff;display:grid;gap:16px}}
.kicker{{font-family:var(--display);font-weight:800;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}}
.band h1{{color:#fff;font-size:30px;font-weight:900}}.band p{{margin:0;color:rgba(255,255,255,.8);font-size:14.5px}}
.stats{{display:flex;flex-wrap:wrap;gap:10px}}.stat{{background:rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;min-width:120px}}
.stat b{{display:block;font-family:var(--display);font-size:22px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums}}.stat span{{font-size:12px;color:rgba(255,255,255,.72)}}
.section-title{{font-family:var(--display);font-weight:800;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--teal);margin:8px 2px 0}}
.grid{{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))}}
.card{{background:var(--card);border:1px solid var(--panel-border);border-radius:14px;padding:16px 18px;display:grid;gap:10px;align-content:start;min-width:0}}
.card.done{{border-left:4px solid var(--ok-fg)}}.card.skipped{{border-left:4px solid var(--faint)}}
.card-head{{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}}.card h3{{font-size:16px}}.num{{font-family:var(--display);font-weight:900;color:var(--faint);font-size:13px;margin-right:6px}}
.body{{margin:0;font-size:14px}}ul.hl{{margin:0;padding-left:18px;display:grid;gap:4px;font-size:13.5px}}
.pill{{font-family:var(--display);font-weight:800;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:3px 10px;white-space:nowrap}}
.pill.done{{background:var(--ok-bg);color:var(--ok-fg)}}.pill.skipped,.pill.closed{{background:var(--chip-bg);color:var(--chip-fg)}}
.note{{font-size:13px;color:var(--gold-fg);background:var(--gold-bg);border-radius:8px;padding:6px 10px;margin:0}}
.counts{{display:flex;gap:14px;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}}.counts b{{color:var(--navy)}}
.tbl{{background:var(--card);border:1px solid var(--panel-border);border-radius:14px;overflow-x:auto}}
table{{width:100%;border-collapse:collapse;font-size:13.5px}}th,td{{text-align:left;padding:10px 14px;border-bottom:1px solid #eceff3;vertical-align:top}}
th{{font-family:var(--display);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}}td.n{{font-family:var(--display);font-weight:900;color:var(--faint)}}
tr:last-child td{{border-bottom:0}}.list{{margin:0;padding-left:20px;display:grid;gap:6px;font-size:14px}}
footer{{font-size:12.5px;color:var(--muted);text-align:center}}
@media (max-width:520px){{.band h1{{font-size:24px}}.stat{{min-width:0;flex:1 1 40%}}}}
</style></head><body><main class="wrap">
<header class="band"><div><div class="kicker">True North Operations Portal · Layer 3</div><h1>Portal Audit: the report</h1>
<p>{e(d["report_intro"])}</p></div>
<div class="stats">
<div class="stat"><b>{sum(1 for m in mods if m["status"]=="done")} of {len(mods)}</b><span>Modules reviewed and fixed (one skipped)</span></div>
<div class="stat"><b>{found}</b><span>Findings</span></div>
<div class="stat"><b>{fixed}</b><span>Fixes in production</span></div>
<div class="stat"><b>{decided}</b><span>Your decisions</span></div>
<div class="stat"><b>{len(migrations)}</b><span>Migrations ({migrations[0]} to {migrations[-1]})</span></div>
<div class="stat"><b>{d["tests"]["start"]} → {d["tests"]["now"]}</b><span>Automated tests</span></div>
</div></header>
<div class="section-title">What changed, in five lines</div><div class="grid">{themes}</div>
<div class="section-title">Layer 2 · Module by module</div><div class="grid">{"".join(card(m) for m in mods)}</div>
<div class="section-title">The closing round · the 16 open items</div>
<div class="tbl"><table><thead><tr><th>#</th><th>Item</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{rows}</tbody></table></div>
<div class="section-title">Still open, on purpose</div><article class="card"><ul class="list">{still}</ul></article>
<div class="section-title">Next steps</div><article class="card"><ul class="list">{nexts}</ul></article>
<footer>{e(d["report_footer"])}</footer>
</main></body></html>
'''
(HERE / 'report.html').write_text(page)
print('report.html', len(page), 'bytes;', found, 'found,', fixed, 'fixed,', decided, 'decided,', len(migrations), 'migrations')
