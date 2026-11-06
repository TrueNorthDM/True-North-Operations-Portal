/** An invented topic for the tests: four competitor pages about drying firewood, sharing a vocabulary so terms emerge. */

import { createAnalysis, type Analysis } from './analysis'
import { readProject, type Project, type TopicPage } from './project'

export const BODY = [
  'Seasoned firewood burns hotter and cleaner. A wood moisture meter tells you when firewood is dry enough to burn.',
  'Split the logs and stack the firewood off the ground so air can move through the stack. Dry firewood needs several months of seasoning.',
  'Check the moisture content with a moisture meter. Firewood at twenty percent moisture content or lower is ready to burn.',
  'Wet firewood makes smoke and creosote, which can cause a chimney fire. Burn dry wood to keep the chimney clean.',
]
const page = (n: number, extra: [string, string][] = []): TopicPage => ({
  artifactId: `c${n}`, kind: 'competitor', url: `https://site${n}.example.com/dry-firewood`, title: `Dry firewood ${n}`, desc: '',
  blocks: [['h1', 'How to dry firewood'], ['h2', 'Why moisture content matters'], ...BODY.map(t => ['p', t] as [string, string]), ['h2', 'How long does firewood take to season?'], ['p', 'Most firewood needs six to twelve months of seasoning. How do you know it is ready? Use a moisture meter.'], ...extra],
  links: [['https://other.example.org/x', 'a source']], capturedAt: null, method: 'button',
})
export const PAGES = [1, 2, 3, 4].map(n => page(n))
export const row = (over: Record<string, unknown> = {}, shared = false) => ({
  topic: 'How to dry firewood', primary_keyphrase: 'how to dry firewood', monday_url: null as string | null, client_code: 'BM', shared,
  data: {
    secondary: 'seasoning firewood\nmoisture meter', avoid: 'chainsaw',
    aiOverview: 'Firewood is seasoned by splitting and stacking it. Use a moisture meter to check the moisture content.',
    aiChatgpt: 'Split, stack and cover the top of the firewood stack. Check it with a moisture meter.', aiGemini: 'none', aiPerplexity: 'Seasoning firewood takes six to twelve months.',
    organic: PAGES.map(p => p.url), cited: [] as string[], ...over,
  },
})
export const project = (over: Record<string, unknown> = {}): Project => readProject(row(over))
export const analysis = (p: Project = project(), pages: TopicPage[] = PAGES): Analysis => createAnalysis(p, pages)

