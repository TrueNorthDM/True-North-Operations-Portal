/**
 * Reads the JSON in Claude's answer (phase 3). The prompts ask for JSON only, but
 * a model sometimes wraps it in a code fence or adds a sentence around it, so this
 * tries the whole text, then a fenced block, then the outermost braces. Returns
 * undefined when nothing parses. The Artifact's parseLooseJSON, unchanged in what
 * it accepts.
 */
export function parseLooseJSON(text: string): unknown {
  const t = String(text ?? '').trim()
  try { return JSON.parse(t) } catch { /* try the next way */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) { try { return JSON.parse(fenced[1]) } catch { /* try the next way */ } }
  const starts = ['{', '['].map(c => t.indexOf(c)).filter(i => i >= 0)
  const a = starts.length ? Math.min(...starts) : -1
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch { /* nothing parses */ } }
  return undefined
}
