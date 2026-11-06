/**
 * The words the settings screen uses for the switches and feedback rules. The
 * shapes and limits are in lib/topic-studio/ai/settings.ts; this only names them.
 */

export const SWITCH_LABELS: Record<string, string> = {
  secondary: 'Secondary keyphrases field',
  rich: 'Rich result keyphrases field',
  followups: 'AI follow-up questions field',
  avoid: 'Terms to avoid field',
  questions: 'Questions tab',
  sources: 'Citations tab',
  discussions: 'Discussions tab',
  originality: 'Originality tab',
  interview: 'Interview prompts (Originality tab and brief)',
}

/** group -> [title, field labels]. A field named `on` is the switch for its group. */
export const TERM_RULES: Record<string, [string, Record<string, string>]> = {
  general: ['All term list warnings', { minList: 'Smallest list that gets warnings (terms)' }],
  size: ['List size', { thin: 'Thin below (concepts)', short: 'Short below', max: 'Healthy up to', long: 'Long above' }],
  variants: ['Variants', { share: 'Warn when variants exceed (% of terms)', perTerm: 'Warn when one term has this many variants' }],
  bigGroup: ['One big group', { minTerms: 'Only for groups of at least (terms)', share: 'Warn when a group holds more than (% of terms)' }],
  fewGroups: ['Too few groups', { minTerms: 'Only for lists of at least (terms)', groups: 'Warn when there are fewer groups than' }],
  singles: ['Terms used by one competitor', { share: 'Warn when more than (% of terms)' }],
  relevance: ['Relevance spread', { share: 'Share of terms (%)', spread: 'Spread when used in many pages (%)', spreadOnce: 'Spread when used in one page (%)', minComps: 'Fewest competitors needed' }],
}

export const WRITER_RULES: Record<string, [string, Record<string, string>]> = {
  review: ['Claude review', { noOriginal: 'Say when no original material was found' }],
  coverage: ['Topic coverage', { good: 'Covers it well from (% of the best competitor)', ok: 'Some ideas missing from (%)', h1: 'Check the H1', intro: 'Check the introduction', keys: 'Check key terms in the introduction', cover: 'Share of keyphrase words that must appear (%)', keyNeed: 'Key terms needed in the introduction', introWords: 'Words that count as the introduction' }],
  length: ['Length', { thin: 'Thin below (words)', long: 'Long above (words)' }],
  readability: ['Readability', { target: 'Flesch reading ease to aim for' }],
  terms: ['Terms to consider', { grouped: 'Show groupings by default' }],
  used: ['Terms used', { overuse: 'Offer the overuse check', minWords: 'Fewest words before checking', termMult: 'Term repeats more than (times the competitors)', termPer1k: 'Term per 1,000 words above', wordPer1k: 'Word per 1,000 words above' }],
}
