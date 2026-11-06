'use client'

/**
 * The draft editor of the writer workshop (Topic Studio, phase 2): a rich-text
 * box with the approved toolbar (undo and redo, text and H1 to H4, bold, italic,
 * underline, lists, link, quote), its own undo history, a link bar, and the topic
 * terms painted over the text without touching it.
 *
 * It is a contenteditable the browser edits, so the DOM is the source of truth
 * while someone types; React only mounts it, sets the starting text once and
 * hands the cleaned HTML out (debounced) through onChange. Everything that goes
 * in (typing, paste, drop, a restored version) is rebuilt into the small safe set
 * by cleanDraftHtml first, and the server sanitizes again before it keeps
 * anything. The behaviour is the Artifact's, kept: Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+K.
 */

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { cleanDraftHtml, plainToHtml } from '@/lib/topic-studio/draft-client'
import { termRangesIn, type HighlightSpec } from '@/lib/topic-studio/workshop'

export interface EditorHandle {
  /** The draft as clean HTML right now. */
  html(): string
  /** Replaces the draft (a restored version), as one undoable step. */
  load(html: string): void
  /** Sends any edit still waiting out to onChange at once. */
  flush(): void
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  initialHtml: string
  specs: HighlightSpec[]
  /** The clean HTML after the writer pauses (and on flush). */
  onChange: (html: string) => void
  onSaveNow: () => void
  onHistory: () => void
  saveText: string
  saveState: SaveState
  apiRef: Ref<EditorHandle>
  disabled?: boolean
}

const IDLE_MS = 1200
const PAINT_MS = 250
const HIST_MAX = 100

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
)
const ICONS = {
  save: <Svg><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></Svg>,
  undo: <Svg><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></Svg>,
  redo: <Svg><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></Svg>,
  ul: <Svg><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></Svg>,
  ol: <Svg><line x1="10" x2="21" y1="6" y2="6" /><line x1="10" x2="21" y1="12" y2="12" /><line x1="10" x2="21" y1="18" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></Svg>,
  link: <Svg><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>,
  history: <Svg><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></Svg>,
  quote: <Svg><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></Svg>,
}

/** A web address for a link: https:// added to a bare domain; empty when it is not one. */
const cleanUrl = (s: string): string => {
  const u = s.trim()
  if (/^(https?:\/\/|mailto:)\S+$/i.test(u)) return u
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) ? `https://${u}` : ''
}

const tb = 'inline-flex h-8 min-w-8 items-center justify-center rounded-[7px] border-0 px-2 font-(family-name:--font-display) text-[12.5px] font-extrabold text-foreground transition-colors hover:bg-white hover:text-tn-ink disabled:opacity-35 disabled:hover:bg-transparent aria-pressed:bg-tn-primary aria-pressed:text-[#ffffff]'
function Tb({ label, on, onClick, off, children }: { label: string; on?: boolean; onClick: () => void; off?: boolean; children: ReactNode }) {
  return <button type="button" className={tb} aria-label={label} title={label} aria-pressed={on ?? false} disabled={off} onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>
}
const sep = <span className="mx-1 h-[18px] w-px bg-[var(--panel-border)]" aria-hidden="true" />

export function WriterEditor(props: Props) {
  const { specs, saveState, saveText, disabled } = props
  const el = useRef<HTMLDivElement>(null)
  const hist = useRef<{ stack: string[]; idx: number; t: ReturnType<typeof setTimeout> | null }>({ stack: [], idx: 0, t: null })
  const sel = useRef<Range | null>(null)
  const commitT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paintT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef(false)
  const cb = useRef(props.onChange)
  const saveCb = useRef(props.onSaveNow)
  const specsRef = useRef(specs)
  useEffect(() => { cb.current = props.onChange; saveCb.current = props.onSaveNow; specsRef.current = specs })

  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false, block: 'p', undo: false, redo: false })
  const [link, setLink] = useState<{ open: boolean; url: string }>({ open: false, url: '' })

  /* Highlights: the topic terms painted over the text (CSS Custom Highlight API); nothing is added to the HTML. */
  const paint = useCallback(() => {
    const css = (typeof CSS === 'undefined' ? {} : CSS) as unknown as { highlights?: Map<string, unknown> }
    const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
    if (!css.highlights || !H) return
    css.highlights.delete('term-first'); css.highlights.delete('term-again')
    const root = el.current
    const list = specsRef.current
    if (!root || !list.length) return
    const groups = new Map<Element, Text[]>()
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) {
      const n = w.currentNode as Text
      const key = n.parentElement?.closest('p,h1,h2,h3,h4,li') ?? root
      const arr = groups.get(key) ?? []
      arr.push(n); groups.set(key, arr)
    }
    const first: Range[] = []
    const again: Range[] = []
    const seen = new Set<string>()
    for (const nodes of groups.values()) {
      let text = ''
      const map: { n: Text; s: number; e: number }[] = []
      for (const n of nodes) { map.push({ n, s: text.length, e: text.length + n.nodeValue!.length }); text += n.nodeValue }
      const at = (pos: number, end: boolean): [Text, number] | null => {
        for (const m of map) if (end ? pos > m.s && pos <= m.e : pos >= m.s && pos < m.e) return [m.n, pos - m.s]
        return null
      }
      for (const r of termRangesIn(text, list)) {
        const s0 = at(r.a, false)
        const e0 = at(r.b, true)
        if (!s0 || !e0) continue
        const rg = document.createRange()
        rg.setStart(s0[0], s0[1]); rg.setEnd(e0[0], e0[1])
        ;(seen.has(r.key) ? again : first).push(rg)
        seen.add(r.key)
      }
    }
    if (first.length) css.highlights.set('term-first', new H(...first))
    if (again.length) css.highlights.set('term-again', new H(...again))
  }, [])
  const schedulePaint = useCallback(() => {
    if (paintT.current) clearTimeout(paintT.current)
    paintT.current = setTimeout(paint, PAINT_MS)
  }, [paint])

  /* Selection and toolbar state. */
  const saveSel = useCallback(() => {
    const s = getSelection()
    if (el.current && s && s.rangeCount && el.current.contains(s.anchorNode)) sel.current = s.getRangeAt(0).cloneRange()
  }, [])
  const restoreSel = useCallback(() => {
    const root = el.current
    if (!root) return
    root.focus()
    if (sel.current && root.contains(sel.current.startContainer)) { const s = getSelection(); s?.removeAllRanges(); s?.addRange(sel.current) }
  }, [])
  const blockTag = useCallback((): string => {
    const root = el.current
    const s = getSelection()
    if (!root || !s || !s.rangeCount) return ''
    let n: Node | null = s.anchorNode
    if (n && n.nodeType === 3) n = n.parentNode
    let quote = false
    let head = ''
    let li = false
    while (n && n !== root) {
      const t = n.nodeName.toLowerCase()
      if (t === 'blockquote') quote = true
      else if (/^h[1-4]$/.test(t) && !head) head = t
      else if (t === 'li') li = true
      n = n.parentNode
    }
    return quote ? 'blockquote' : head || (li ? 'li' : 'p')
  }, [])
  const ancestorIn = useCallback((tag: string): Element | null => {
    const root = el.current
    const s = getSelection()
    if (!root || !s || !s.rangeCount) return null
    let n: Node | null = s.anchorNode
    if (n && n.nodeType === 3) n = n.parentNode
    while (n && n !== root) { if (n.nodeName.toLowerCase() === tag) return n as Element; n = n.parentNode }
    return null
  }, [])
  const updateToolbar = useCallback(() => {
    const root = el.current
    const s = getSelection()
    const inEd = !!(root && s && s.rangeCount && root.contains(s.anchorNode))
    const q = (c: string) => { try { return document.queryCommandState(c) } catch { return false } }
    const h = hist.current
    const dirty = !!root && root.innerHTML !== h.stack[h.idx]
    setFmt({
      bold: inEd && q('bold'), italic: inEd && q('italic'), underline: inEd && q('underline'),
      ul: inEd && q('insertUnorderedList'), ol: inEd && q('insertOrderedList'), block: inEd ? blockTag() : '',
      undo: !!root && (h.idx > 0 || dirty), redo: !!root && !dirty && h.idx < h.stack.length - 1,
    })
  }, [blockTag])

  /* Undo history: the editor's own, so a paste or a format is one step. */
  const histPush = useCallback(() => {
    const root = el.current
    const h = hist.current
    if (!root) return
    const html = root.innerHTML
    if (html === h.stack[h.idx]) return
    h.stack = h.stack.slice(0, h.idx + 1)
    h.stack.push(html)
    if (h.stack.length > HIST_MAX) h.stack.shift()
    h.idx = h.stack.length - 1
    updateToolbar()
  }, [updateToolbar])
  const histFlush = useCallback(() => { if (hist.current.t) clearTimeout(hist.current.t); hist.current.t = null; histPush() }, [histPush])

  const out = useCallback(() => {
    pending.current = false
    if (commitT.current) clearTimeout(commitT.current)
    commitT.current = null
    const root = el.current
    if (root) cb.current(cleanDraftHtml(root.innerHTML))
  }, [])
  const onEdit = useCallback(() => {
    const root = el.current
    if (!root) return
    root.classList.toggle('is-empty', !root.textContent?.trim())
    saveSel()
    pending.current = true
    if (commitT.current) clearTimeout(commitT.current)
    commitT.current = setTimeout(out, IDLE_MS)
    updateToolbar()
    schedulePaint()
  }, [out, saveSel, schedulePaint, updateToolbar])

  const placeCaretEnd = (root: HTMLElement) => {
    const r = document.createRange()
    r.selectNodeContents(root); r.collapse(false)
    const s = getSelection()
    s?.removeAllRanges(); s?.addRange(r)
  }
  const histGo = (dir: 1 | -1) => {
    const root = el.current
    const h = hist.current
    if (!root) return
    histFlush()
    const i = h.idx + dir
    if (i < 0 || i >= h.stack.length) return
    h.idx = i
    root.innerHTML = h.stack[i]
    root.focus(); placeCaretEnd(root); saveSel(); onEdit()
  }

  /* Formatting. */
  const dx = (c: string, v?: string) => { try { return document.execCommand(c, false, v) } catch { return false } }
  const edExec = (fn: () => void) => {
    if (!el.current) return
    histFlush(); restoreSel()
    dx('defaultParagraphSeparator', 'p')
    try { fn() } catch (e) { console.error(e) }
    histPush(); onEdit()
  }
  const setBlock = (tag: string) => edExec(() => {
    const cur = blockTag()
    if (cur === 'blockquote') { dx('outdent'); dx('formatBlock', '<p>'); if (tag === 'blockquote' || tag === 'p') return }
    else if (cur === 'li') dx(ancestorIn('ol') ? 'insertOrderedList' : 'insertUnorderedList')
    const t = cur === tag && /^h[1-4]$/.test(tag) ? 'p' : tag
    dx('formatBlock', `<${t}>`)
  })
  const openLink = () => {
    if (!el.current) return
    saveSel()
    const a = ancestorIn('a')
    setLink({ open: true, url: a?.getAttribute('href') ?? '' })
  }
  const closeLink = () => { setLink({ open: false, url: '' }); restoreSel() }
  const applyLink = () => {
    const url = cleanUrl(link.url)
    if (!url) return
    setLink({ open: false, url: '' })
    edExec(() => {
      const s = getSelection()
      const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      if (s?.isCollapsed && !ancestorIn('a')) dx('insertHTML', `<a href="${esc(url)}">${esc(url)}</a>`)
      else dx('createLink', url)
    })
  }
  const removeLink = () => { setLink({ open: false, url: '' }); edExec(() => { dx('unlink') }) }

  /* Paste and drop: rebuilt into the safe set before anything goes in. */
  const insertInto = (html: string, txt: string) => {
    const root = el.current
    if (!root) return
    let clean = html && /<[a-z]/i.test(html) ? cleanDraftHtml(html) : ''
    if (!clean) clean = plainToHtml(txt)
    if (!clean) return
    histFlush()
    // A single pasted paragraph joins the paragraph being written instead of splitting it.
    const one = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html').body
    if (root.textContent?.trim() && one.children.length === 1 && one.firstElementChild?.tagName === 'P') clean = one.firstElementChild.innerHTML
    restoreSel()
    dx('defaultParagraphSeparator', 'p')
    dx('insertHTML', clean)
    histPush(); onEdit()
  }
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => { e.preventDefault(); insertInto(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain')) }
  const dragging = useRef(false)
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (dragging.current) { dragging.current = false; setTimeout(() => { histPush(); onEdit() }, 0); return }
    e.preventDefault()
    insertInto(e.dataTransfer.getData('text/html'), e.dataTransfer.getData('text/plain'))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'z') { e.preventDefault(); histGo(e.shiftKey ? 1 : -1) }
    else if (k === 'y') { e.preventDefault(); histGo(1) }
    else if (k === 's') { e.preventDefault(); saveCb.current() }
    else if (k === 'k') { e.preventDefault(); openLink() }
  }

  useImperativeHandle(props.apiRef, () => ({
    html: () => (el.current ? cleanDraftHtml(el.current.innerHTML) : ''),
    load: (html: string) => {
      const root = el.current
      if (!root) return
      histFlush()
      root.innerHTML = cleanDraftHtml(html)
      histPush(); onEdit()
    },
    flush: () => { if (pending.current) out() },
  }), [histFlush, histPush, onEdit, out])

  // Mount: the starting text goes in once; typing is the browser's from then on.
  useLayoutEffect(() => {
    const root = el.current
    if (!root) return
    root.innerHTML = cleanDraftHtml(props.initialHtml)
    root.classList.toggle('is-empty', !root.textContent?.trim())
    hist.current = { stack: [root.innerHTML], idx: 0, t: null }
    paint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { paint() }, [specs, paint])
  useEffect(() => {
    const onSel = () => { if (el.current && el.current.contains(getSelection()?.anchorNode ?? null)) { saveSel(); updateToolbar() } }
    const onFocus = () => dx('defaultParagraphSeparator', 'p')
    document.addEventListener('selectionchange', onSel)
    const root = el.current
    root?.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('selectionchange', onSel)
      root?.removeEventListener('focus', onFocus)
      for (const t of [commitT.current, paintT.current, hist.current.t]) if (t) clearTimeout(t)
      const css = (typeof CSS === 'undefined' ? {} : CSS) as unknown as { highlights?: Map<string, unknown> }
      css.highlights?.delete('term-first'); css.highlights?.delete('term-again')
    }
  }, [saveSel, updateToolbar])

  const dot = saveState === 'saving' ? 'bg-[#e0940e]' : saveState === 'error' ? 'bg-[#c8323d]' : saveState === 'saved' ? 'bg-tn-green' : 'bg-[var(--faint)]'

  return (
    <div>
      <div role="toolbar" aria-label="Draft formatting" className="flex flex-wrap items-center gap-0.5 rounded-t-[14px] border-b border-[var(--panel-border)] bg-subtle px-2 py-1.5">
        <button type="button" className={`${tb} relative`} aria-label="Save version" title={`Save version (Ctrl+S)${saveText ? ` · ${saveText}` : ''}`} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => props.onSaveNow()}>
          {ICONS.save}<i className={`absolute right-1 top-1 h-[7px] w-[7px] rounded-full ${dot}`} aria-hidden="true" />
        </button>
        <Tb label="Undo (Ctrl+Z)" onClick={() => histGo(-1)} off={!fmt.undo || disabled}>{ICONS.undo}</Tb>
        <Tb label="Redo (Ctrl+Shift+Z)" onClick={() => histGo(1)} off={!fmt.redo || disabled}>{ICONS.redo}</Tb>
        {sep}
        <Tb label="Paragraph" on={fmt.block === 'p'} onClick={() => setBlock('p')} off={disabled}>Text</Tb>
        <Tb label="Heading 1" on={fmt.block === 'h1'} onClick={() => setBlock('h1')} off={disabled}>H1</Tb>
        <Tb label="Heading 2" on={fmt.block === 'h2'} onClick={() => setBlock('h2')} off={disabled}>H2</Tb>
        <Tb label="Heading 3" on={fmt.block === 'h3'} onClick={() => setBlock('h3')} off={disabled}>H3</Tb>
        <Tb label="Heading 4" on={fmt.block === 'h4'} onClick={() => setBlock('h4')} off={disabled}>H4</Tb>
        {sep}
        <Tb label="Bold (Ctrl+B)" on={fmt.bold} onClick={() => edExec(() => { dx('bold') })} off={disabled}><b>B</b></Tb>
        <Tb label="Italic (Ctrl+I)" on={fmt.italic} onClick={() => edExec(() => { dx('italic') })} off={disabled}><i>I</i></Tb>
        <Tb label="Underline (Ctrl+U)" on={fmt.underline} onClick={() => edExec(() => { dx('underline') })} off={disabled}><u>U</u></Tb>
        {sep}
        <Tb label="Bulleted list" on={fmt.ul} onClick={() => edExec(() => { dx('insertUnorderedList') })} off={disabled}>{ICONS.ul}</Tb>
        <Tb label="Numbered list" on={fmt.ol} onClick={() => edExec(() => { dx('insertOrderedList') })} off={disabled}>{ICONS.ol}</Tb>
        <Tb label="Add or edit a link (Ctrl+K)" onClick={openLink} off={disabled}>{ICONS.link}</Tb>
        <Tb label="Quote" on={fmt.block === 'blockquote'} onClick={() => setBlock('blockquote')} off={disabled}>{ICONS.quote}</Tb>
        <span className="flex-1" />
        <Tb label="Version history" onClick={props.onHistory}>{ICONS.history}</Tb>
        <span className="sr-only" role="status" aria-live="polite">{saveText}</span>
      </div>
      {link.open && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--panel-border)] bg-tn-teal-soft px-3 py-2">
          <input autoFocus type="url" aria-label="Link address" placeholder="https://…" autoComplete="off" value={link.url}
            className="h-8 min-w-[220px] flex-1 rounded-[8px] border border-[var(--panel-border)] bg-white px-2.5 text-[12.5px] text-tn-ink outline-none focus:border-tn-teal"
            onChange={e => setLink({ open: true, url: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } else if (e.key === 'Escape') { e.preventDefault(); closeLink() } }} />
          <button type="button" className="rounded-[8px] bg-tn-primary px-3 py-1.5 font-(family-name:--font-display) text-[12.5px] font-extrabold text-[#ffffff]" onClick={applyLink} disabled={!cleanUrl(link.url)}>Apply</button>
          <button type="button" className="rounded-[8px] border border-[var(--panel-border)] bg-white px-3 py-1.5 font-(family-name:--font-display) text-[12.5px] font-extrabold text-tn-ink" onClick={removeLink}>Remove link</button>
          <button type="button" className="font-(family-name:--font-display) text-[12.5px] font-extrabold text-tn-teal hover:underline" onClick={closeLink}>Cancel</button>
        </div>
      )}
      <div
        ref={el} className="ts-editor is-empty" contentEditable={!disabled} suppressContentEditableWarning spellCheck role="textbox" aria-multiline="true" aria-label="Your draft"
        data-ph="Paste or write your article here…"
        onInput={() => { const h = hist.current; if (h.t) clearTimeout(h.t); h.t = setTimeout(histPush, 700); onEdit() }}
        onPaste={onPaste} onDrop={onDrop} onDragStart={() => { dragging.current = true }} onDragEnd={() => { dragging.current = false }} onKeyDown={onKeyDown}
      />
    </div>
  )
}
