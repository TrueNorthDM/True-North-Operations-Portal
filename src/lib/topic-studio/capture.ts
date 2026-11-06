/**
 * Capturing a competitor page for Topic Studio (phase 1, 5 November 2026).
 *
 * Two ways in, both from the Artifact and kept as it has them:
 *   the bookmark button  CAPTURE_SOURCE runs on the competitor's own page and
 *                        copies { _hfa: 2, url, title, desc, blocks, links } as
 *                        JSON; the person pastes that into the portal.
 *   paste                the person copies the article (or the whole page) and
 *                        pastes it: parseCapture reads the JSON from the button,
 *                        or HTML from the clipboard, or plain text lines.
 *
 * CAPTURE_SOURCE is a string on purpose: the bookmarklet is that text, and a
 * bundler is free to rewrite a function's own source. It must stay
 * self-contained (it runs on someone else's site). The paste path builds the
 * same function from it, so there is one capture code, not two.
 *
 * Browser only (DOMParser). The server never trusts what arrives: see
 * cleanCapture in capture-clean.ts.
 */

import { countWords } from './engine'
import type { Block } from './engine'

/** The Artifact's hfaCapture, as text. Runs on the page being captured (mode 'bm') or on pasted HTML (mode 'paste'). */
export const CAPTURE_SOURCE = String.raw`/* Shared by the bookmarklet and the paste handler. Must stay self-contained. */
function hfaCapture(doc, mode, host) {
  var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
  var len = function (e) { return clean(e.textContent).length; };
  var JUNK = 'script,style,noscript,template,iframe,svg,canvas,video,audio,form,button,select,input,textarea,nav,footer,aside,[role=navigation],[role=contentinfo],[role=complementary],[aria-hidden=true],.share,.sharing,.social,.social-share,.sharedaddy,.jp-relatedposts,.related,.related-posts,.yarpp-related,.comments,#comments,.comment-respond,.newsletter,.subscribe,.sidebar,#sidebar,.breadcrumb,.breadcrumbs,.author-box,.post-navigation,.nav-links,.ad,.ads,.advert,.advertisement,.toc,#toc,.table-of-contents,.ez-toc-container,.wp-block-buttons';
  var BL = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,dd,dt,td,th,figcaption,pre';
  var root = doc.body;
  if (mode === 'bm') {
    var sel = 'article,main,[role=main],[itemprop=articleBody],.entry-content,.post-content,.article-content,.article-body,.post-body,.blog-content,.single-content,.content-area,#content,.content';
    var pscore = function (e) { var t = 0; e.querySelectorAll('p').forEach(function (p) { t += len(p); }); return t; };
    var scored = Array.prototype.slice.call(doc.querySelectorAll(sel)).map(function (e) { return { e: e, p: pscore(e), t: len(e) }; }).filter(function (x) { return x.p > 300; });
    if (scored.length) {
      var max = Math.max.apply(null, scored.map(function (x) { return x.p; }));
      scored = scored.filter(function (x) { return x.p >= max * 0.85; });
      scored.sort(function (a, b) { return a.t - b.t; });
      root = scored[0].e;
    } else {
      var m = new Map(), best = null, bs = 0;
      doc.querySelectorAll('p').forEach(function (p) { var par = p.parentElement; if (par) m.set(par, (m.get(par) || 0) + len(p)); });
      m.forEach(function (v, k) { if (v > bs) { bs = v; best = k; } });
      root = best || doc.body;
    }
  }
  var c = root.cloneNode(true);
  c.querySelectorAll(JUNK).forEach(function (e) { e.remove(); });
  c.querySelectorAll('header').forEach(function (e) { if (!e.querySelector('h1,h2')) e.remove(); });
  var blocks = [];
  var push = function (tag, t) { t = clean(t); if (!t) return; var last = blocks[blocks.length - 1]; if (last && last[1] === t) return; blocks.push([tag, t]); };
  c.querySelectorAll(BL).forEach(function (e) {
    var tag = e.tagName.toLowerCase();
    if (!/^h\d$/.test(tag) && e.querySelector(BL)) {
      var own = '';
      e.childNodes.forEach(function (n) { if (n.nodeType === 3) own += n.textContent; else if (n.nodeType === 1 && !n.matches(BL) && !n.querySelector(BL)) own += ' ' + n.textContent; });
      push(tag, own); return;
    }
    if (e.parentElement && e.parentElement.closest('h1,h2,h3,h4,h5,h6')) return;
    push(tag, e.textContent);
  });
  var blockLen = blocks.reduce(function (n, b) { return n + b[1].length; }, 0);
  if (blockLen < len(c) * 0.4) {
    c.querySelectorAll('div,section,span,font,center').forEach(function (e) {
      var own = ''; e.childNodes.forEach(function (n) { if (n.nodeType === 3) own += n.textContent; });
      own = clean(own); if (own.length > 40) push('p', own);
    });
    if (!blocks.length) clean(c.textContent).split(/(?<=[.!?])\s+(?=[A-Z])/).forEach(function (s) { push('p', s); });
  }
  var h1 = doc.querySelector('h1');
  var title = clean(h1 ? h1.textContent : '') || clean(doc.title || '');
  if (mode === 'bm' && title && !blocks.some(function (b) { return b[0] === 'h1'; })) blocks.unshift(['h1', title]);
  var links = [], seen = {};
  c.querySelectorAll('a[href]').forEach(function (a) {
    var h = a.getAttribute('href') || '';
    if (!/^https?:/i.test(h)) { if (mode !== 'bm' || /^(#|mailto:|tel:|javascript:)/i.test(h)) return; try { h = new URL(h, location.href).href; } catch (e) { return; } }
    var hh; try { hh = new URL(h).hostname.replace(/^www\./, ''); } catch (e) { return; }
    if (host && hh === host) return;
    if (seen[h]) return; seen[h] = 1;
    links.push([h, clean(a.textContent).slice(0, 140)]);
  });
  var md = doc.querySelector('meta[name="description"],meta[property="og:description"]');
  var out = { _hfa: 2, url: mode === 'bm' ? location.href : '', title: title, desc: md ? clean(md.getAttribute('content')) : '', blocks: blocks, links: links };
  if (mode !== 'bm') return out;
  var s = JSON.stringify(out);
  var words = blocks.reduce(function (n, b) { return n + b[1].split(/\s+/).length; }, 0);
  var show = function (msg, ok) {
    var d = doc.createElement('div');
    d.setAttribute('style', 'position:fixed;z-index:2147483647;top:16px;right:16px;max-width:340px;padding:14px 16px;border-radius:10px;font:600 14px/1.45 system-ui,sans-serif;color:#fff;background:' + (ok ? '#002157' : '#9b3b2a') + ';box-shadow:0 8px 28px rgba(0,0,0,.28)');
    d.textContent = msg; doc.body.appendChild(d); setTimeout(function () { d.remove(); }, 5000);
  };
  var okMsg = 'Captured ' + words + ' words, ' + blocks.filter(function (b) { return /^h/.test(b[0]); }).length + ' headings. Paste it into Topic Studio.';
  var manual = function () {
    var w = doc.createElement('div');
    w.setAttribute('style', 'position:fixed;z-index:2147483647;inset:20px;background:#fff;color:#111;padding:16px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:8px;font:14px system-ui,sans-serif');
    var p = doc.createElement('div'); p.textContent = 'This site blocked automatic copying. Press Ctrl+C (Cmd+C on Mac) now, then close this box.';
    var t = doc.createElement('textarea'); t.value = s; t.setAttribute('style', 'flex:1;width:100%;font:12px monospace');
    var b = doc.createElement('button'); b.textContent = 'Close'; b.onclick = function () { w.remove(); };
    w.appendChild(p); w.appendChild(t); w.appendChild(b); doc.body.appendChild(w); t.focus(); t.select();
  };
  var fallback = function () {
    var t = doc.createElement('textarea'); t.value = s; t.setAttribute('style', 'position:fixed;top:0;left:0;opacity:0');
    doc.body.appendChild(t); t.focus(); t.select(); var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) {}
    t.remove(); if (ok) show(okMsg, true); else manual();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(function () { show(okMsg, true); }, fallback); else fallback();
}`

export interface Capture {
  /** 2 from the bookmark button, 0 for text. */
  _hfa: number
  url: string
  title: string
  desc: string
  blocks: Block[]
  links: [string, string][]
}

type CaptureFn = (doc: Document, mode: 'bm' | 'paste', host: string) => Capture

let fn: CaptureFn | null = null
function captureFn(): CaptureFn {
  return (fn ??= new Function(`return (${CAPTURE_SOURCE})`)() as CaptureFn)
}

/** The href of the bookmark button: javascript: plus the capture code, run on the page with its host. */
export function bookmarkletHref(): string {
  return `javascript:${encodeURIComponent(`(${CAPTURE_SOURCE})(document,'bm',location.hostname.replace(/^www\\./,''))`)}`
}

/**
 * What a paste holds. `txt` and `html` are the clipboard's two flavours; `host`
 * is the competitor's own domain, whose links are left out. Null when there is
 * nothing to capture.
 */
export function parseCapture(txt: string, html: string, host: string): Capture | null {
  const t = (txt || '').trim()
  if (t.startsWith('{') && t.includes('"_hfa"')) {
    try { const o = JSON.parse(t) as Capture; if (o && Array.isArray(o.blocks)) return o } catch { /* not the button's JSON: read it as text */ }
  }
  if (html && /<[a-z]/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const o = captureFn()(doc, 'paste', host)
    if (o.blocks.length) return o
  }
  if (!t) return null
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  const blocks: Block[] = lines.map((ln, i) => {
    const wc = countWords(ln)
    const next = lines[i + 1] || ''
    // A short line with no closing punctuation, followed by a longer one, is a heading.
    const headingish = wc <= 14 && !/[.,;:"”)]$/.test(ln) && countWords(next) > wc
    return [headingish ? (i === 0 ? 'h1' : 'h2') : 'p', ln]
  })
  return { _hfa: 0, url: '', title: blocks[0] ? blocks[0][1] : '', desc: '', blocks, links: [] }
}
