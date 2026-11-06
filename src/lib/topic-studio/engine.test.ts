import { describe, expect, it } from 'vitest'
import {
  RULES_DEFAULT, STOP, bibleRefs, buildCandidates, buildSource, countIn, countWords, extractQuestions, flesch, fleschLabel,
  hashId, hostOf, letterGrade, makeAvoidTest, median, mixOrder, normUrl, pct, scoreAgainst, stem, termKey, tokenize,
  type Block, type Ctx, type Term,
} from './engine'

/* Equivalence test: the golden values were produced by the original Artifact engine (plain JS) on this same corpus. */
interface Page { label: string; url: string; rank: number; title: string; desc: string; blocks: Block[] }
const CORPUS: { topic: string; primary: string; secondary: string; avoid: string; aiText: string; pages: Page[] } = {
  "topic": "How to dry firewood",
  "primary": "how to dry firewood",
  "secondary": "seasoning firewood\nfirewood moisture content",
  "avoid": "kiln drying lumber",
  "aiText": "To dry firewood, split the logs, stack them off the ground in a sunny, windy spot, and cover only the top. Seasoned firewood usually needs six to twelve months to dry. Check the moisture content with a moisture meter: well seasoned firewood reads below 20 percent.\nHardwoods like oak take longer to season than softwoods like pine. Split wood dries faster than whole logs, so split firewood early.",
  "pages": [
    {
      "label": "Competitor 1",
      "url": "https://www.woodpile.example/how-to-dry-firewood/",
      "rank": 1,
      "title": "How to Dry Firewood Fast: A Complete Guide",
      "desc": "Learn how to dry firewood, season split logs and check moisture content.",
      "blocks": [
        [
          "h1",
          "How to Dry Firewood Fast"
        ],
        [
          "p",
          "Freshly cut firewood is full of water. Green wood can hold more than 50 percent moisture content, so it burns poorly, smokes a lot and leaves creosote in your chimney. If you want a clean, hot fire, you need to dry firewood before you burn it."
        ],
        [
          "h2",
          "Why seasoning firewood matters"
        ],
        [
          "p",
          "Seasoned firewood lights easily and burns hot. Wet logs waste energy boiling off water. Seasoning firewood properly takes time, but the wait pays off with more heat and less smoke."
        ],
        [
          "h2",
          "Split the logs first"
        ],
        [
          "p",
          "Split firewood dries much faster than whole logs because the bark slows down evaporation. Split the logs as soon as you can after cutting. Smaller pieces expose more surface to the air."
        ],
        [
          "h2",
          "Stack firewood off the ground"
        ],
        [
          "p",
          "Stack the split wood in rows on pallets or rails so air can move under the pile. Leave a gap between rows. Pick a sunny, windy spot, because sun and wind pull moisture out of the wood."
        ],
        [
          "ul",
          ""
        ],
        [
          "li",
          "Keep the stack off the ground"
        ],
        [
          "li",
          "Cover only the top of the stack"
        ],
        [
          "li",
          "Leave the sides open for airflow"
        ],
        [
          "h2",
          "How long does it take to season firewood?"
        ],
        [
          "p",
          "Most hardwoods need six to twelve months. Oak can take two years. Softwoods such as pine dry in about six months. Is your wood ready? Use a moisture meter and look for a reading under 20 percent."
        ],
        [
          "h2",
          "Check moisture content with a moisture meter"
        ],
        [
          "p",
          "Split a log and press the pins of the moisture meter into the fresh face. Seasoned firewood reads between 15 and 20 percent. Dry wood also has cracks at the ends and sounds hollow when two pieces knock together."
        ]
      ]
    },
    {
      "label": "Competitor 2",
      "url": "https://firewoodhub.example/seasoning-firewood",
      "rank": 2,
      "title": "Seasoning Firewood: How Long to Dry Wood",
      "desc": "A simple guide to seasoning firewood and drying split logs.",
      "blocks": [
        [
          "h1",
          "Seasoning Firewood at Home"
        ],
        [
          "p",
          "Anyone who heats with wood should know how to dry firewood. Seasoning firewood means letting the wood lose its water slowly over several months. The goal is firewood with a moisture content below 20 percent."
        ],
        [
          "h2",
          "Choose the right wood"
        ],
        [
          "p",
          "Hardwoods like oak, maple and ash burn longer and hotter, but they take longer to season. Softwoods like pine and spruce dry quickly and are good for kindling."
        ],
        [
          "h2",
          "Split and stack the logs"
        ],
        [
          "p",
          "Split the logs to the size of your stove. Stack the firewood in a single row with the bark side up. A good stack lets the wind blow through the pile, which speeds up drying."
        ],
        [
          "h2",
          "How long should firewood season?"
        ],
        [
          "p",
          "Plan on at least six months for most species. Hardwood such as oak needs closer to a year. Test the moisture content before you burn, because wet firewood makes creosote."
        ],
        [
          "h3",
          "Signs that firewood is dry"
        ],
        [
          "li",
          "Dark, cracked ends on the logs"
        ],
        [
          "li",
          "Light weight compared to green wood"
        ],
        [
          "li",
          "A clear ringing sound when you knock two logs"
        ],
        [
          "h2",
          "Use a moisture meter"
        ],
        [
          "p",
          "A moisture meter is the surest way to know the moisture content of your firewood. Push the pins into a freshly split face and read the number. Under 20 percent means the firewood is seasoned and ready to burn."
        ],
        [
          "h2",
          "Store dry firewood"
        ],
        [
          "p",
          "Once the wood has seasoned, keep it dry under a roof or a cover. Rain and snow will soak the logs again, and then you have to dry the firewood twice."
        ]
      ]
    },
    {
      "label": "Competitor 3",
      "url": "https://homestead-heat.example/guides/dry-firewood-quickly",
      "rank": 3,
      "title": "How to Dry Firewood Quickly",
      "desc": "Dry firewood quickly with these tips on splitting, stacking and covering your wood pile.",
      "blocks": [
        [
          "h1",
          "How to Dry Firewood Quickly"
        ],
        [
          "p",
          "Nobody likes a smoky fire. If your logs hiss and sputter, the wood is wet. Here is how to dry firewood quickly and safely, step by step."
        ],
        [
          "h2",
          "Step 1: Split the logs"
        ],
        [
          "p",
          "Splitting firewood opens the wood to the air. Split firewood can season in half the time of round logs. Use a maul or a log splitter, and split the logs as soon as possible."
        ],
        [
          "h2",
          "Step 2: Stack firewood in the sun"
        ],
        [
          "p",
          "Stack your firewood off the ground in a sunny spot with good wind. A wood pile in the shade dries slowly. Leave space between the rows so the air can move."
        ],
        [
          "h2",
          "Step 3: Cover the top of the stack"
        ],
        [
          "p",
          "Cover the top of the woodpile with a tarp or a sheet of metal, but leave the sides open. A tarp wrapped around the whole stack traps moisture and the wood will not dry."
        ],
        [
          "h2",
          "Step 4: Test the moisture content"
        ],
        [
          "p",
          "Use a moisture meter to check the moisture content. Firewood below 20 percent is seasoned. If the reading is higher, give the wood more time. How much time depends on the species and the weather."
        ],
        [
          "h2",
          "Frequently asked questions"
        ],
        [
          "h3",
          "Can you dry firewood in a kiln?"
        ],
        [
          "p",
          "Yes, kiln dried firewood is sold in many stores, but you can season firewood at home for free."
        ],
        [
          "h3",
          "Does wood dry faster in summer?"
        ],
        [
          "p",
          "Yes. Warm weather and wind help firewood dry. Start your wood pile in spring so it is ready by fall."
        ]
      ]
    },
    {
      "label": "Competitor 4",
      "url": "https://www.chimneysafe.example/firewood-drying",
      "rank": 4,
      "title": "Drying Firewood: Seasoning Time and Moisture Content",
      "desc": "How long to season firewood, and how to check the moisture content with a meter.",
      "blocks": [
        [
          "h1",
          "Drying Firewood: Seasoning Time and Moisture"
        ],
        [
          "p",
          "Burning wet firewood is the leading cause of creosote buildup. Creosote can start a chimney fire. Seasoned firewood burns cleaner, so it is worth the effort to dry firewood properly."
        ],
        [
          "h2",
          "What is seasoned firewood?"
        ],
        [
          "p",
          "Seasoned firewood is wood that has dried to a moisture content of about 15 to 20 percent. Green wood is freshly cut and holds far more water. Seasoning firewood is simply drying it."
        ],
        [
          "h2",
          "How to stack firewood for drying"
        ],
        [
          "p",
          "Stack the split wood off the ground, with the bark facing up. Cover only the top. The wind and the sun do most of the work, so choose an open spot away from the house."
        ],
        [
          "h2",
          "How long to dry firewood"
        ],
        [
          "p",
          "The time to season firewood depends on the species. Pine takes six months, maple about a year and oak up to two years. Split logs dry faster, and a warm, windy summer shortens the wait."
        ],
        [
          "h2",
          "Measure the moisture content"
        ],
        [
          "p",
          "The best tool is a moisture meter. Split a piece, press the meter against the fresh face and read the moisture content. Wood at or under 20 percent is ready for the stove."
        ],
        [
          "h2",
          "Common mistakes"
        ],
        [
          "li",
          "Stacking wood directly on the ground"
        ],
        [
          "li",
          "Covering the whole pile with a tarp"
        ],
        [
          "li",
          "Leaving the logs unsplit"
        ],
        [
          "p",
          "Avoid these mistakes and your firewood will be dry and ready for winter."
        ]
      ]
    },
    {
      "label": "Competitor 5",
      "url": "https://cabinwoodstove.example/blog/how-to-season-wood",
      "rank": 5,
      "title": "How to Season Wood for the Stove",
      "desc": "Season wood for your stove: split, stack and cover your firewood.",
      "blocks": [
        [
          "h1",
          "How to Season Wood for Your Stove"
        ],
        [
          "p",
          "Good heat starts with dry firewood. If you cut your own wood, you have to season it before the cold weather comes. This guide covers how to dry firewood the simple way."
        ],
        [
          "h2",
          "Cut and split early"
        ],
        [
          "p",
          "Cut the trees in winter or early spring and split the logs right away. Split wood loses water faster. Stack the firewood the same day if you can."
        ],
        [
          "h2",
          "Stack the wood pile"
        ],
        [
          "p",
          "Build the wood pile in a sunny place off the ground. Rows that run in the direction of the prevailing wind dry best. Cover the top of the stack and leave the sides open to the air."
        ],
        [
          "h2",
          "How long to season firewood"
        ],
        [
          "p",
          "Six months is the minimum for most firewood. Hardwoods, such as oak and hickory, need a year or more. A moisture meter takes the guesswork out of it. Firewood under 20 percent moisture content is ready."
        ],
        [
          "h2",
          "Kiln drying lumber vs seasoning logs"
        ],
        [
          "p",
          "Kiln drying lumber is a commercial process that uses heat. Home seasoning relies on sun and wind, and it costs nothing but time."
        ],
        [
          "h2",
          "Store the seasoned firewood"
        ],
        [
          "p",
          "Keep seasoned firewood under cover close to the house. A dry woodpile means a hot, clean fire all winter."
        ]
      ]
    }
  ]
}

const GOLDEN = {
  "first25": [
    {
      "k": "dry firewood",
      "t": "dry firewood",
      "df": 5,
      "tf": 11,
      "n": 2,
      "score": 1.355948,
      "why": "secondary"
    },
    {
      "k": "split the log",
      "t": "split the logs",
      "df": 4,
      "tf": 6,
      "n": 3,
      "score": 1.332189,
      "why": ""
    },
    {
      "k": "firewood",
      "t": "firewood",
      "df": 5,
      "tf": 52,
      "n": 1,
      "score": 1.258869,
      "why": "secondary"
    },
    {
      "k": "dry",
      "t": "dry",
      "df": 5,
      "tf": 26,
      "n": 1,
      "score": 1.145867,
      "why": ""
    },
    {
      "k": "moisture meter",
      "t": "moisture meter",
      "df": 5,
      "tf": 8,
      "n": 2,
      "score": 1.141856,
      "why": "secondary"
    },
    {
      "k": "moisture content",
      "t": "moisture content",
      "df": 5,
      "tf": 11,
      "n": 2,
      "score": 1.103624,
      "why": "secondary"
    },
    {
      "k": "seasoned firewood",
      "t": "seasoned firewood",
      "df": 3,
      "tf": 7,
      "n": 2,
      "score": 1.04907,
      "why": "secondary"
    },
    {
      "k": "wood",
      "t": "wood",
      "df": 5,
      "tf": 27,
      "n": 1,
      "score": 0.999016,
      "why": ""
    },
    {
      "k": "log",
      "t": "logs",
      "df": 5,
      "tf": 19,
      "n": 1,
      "score": 0.974868,
      "why": ""
    },
    {
      "k": "20 percent",
      "t": "20 percent",
      "df": 5,
      "tf": 8,
      "n": 2,
      "score": 0.97222,
      "why": ""
    },
    {
      "k": "wood dry faster",
      "t": "wood dry faster",
      "df": 1,
      "tf": 1,
      "n": 3,
      "score": 0.922776,
      "why": ""
    },
    {
      "k": "seasoned firewood read",
      "t": "seasoned firewood reads",
      "df": 1,
      "tf": 1,
      "n": 3,
      "score": 0.91665,
      "why": "secondary"
    },
    {
      "k": "season firewood",
      "t": "season firewood",
      "df": 4,
      "tf": 4,
      "n": 2,
      "score": 0.794223,
      "why": "secondary"
    },
    {
      "k": "oak",
      "t": "oak",
      "df": 4,
      "tf": 5,
      "n": 1,
      "score": 0.745984,
      "why": ""
    },
    {
      "k": "seasoning firewood",
      "t": "seasoning firewood",
      "df": 3,
      "tf": 5,
      "n": 2,
      "score": 0.745115,
      "why": "secondary"
    },
    {
      "k": "split wood",
      "t": "split wood",
      "df": 3,
      "tf": 3,
      "n": 2,
      "score": 0.733919,
      "why": ""
    },
    {
      "k": "split firewood",
      "t": "split firewood",
      "df": 2,
      "tf": 2,
      "n": 2,
      "score": 0.718201,
      "why": "secondary"
    },
    {
      "k": "dry faster",
      "t": "dry faster",
      "df": 2,
      "tf": 2,
      "n": 2,
      "score": 0.714904,
      "why": ""
    },
    {
      "k": "hardwood",
      "t": "hardwoods",
      "df": 3,
      "tf": 4,
      "n": 1,
      "score": 0.637916,
      "why": ""
    },
    {
      "k": "stack firewood",
      "t": "stack firewood",
      "df": 3,
      "tf": 3,
      "n": 2,
      "score": 0.637746,
      "why": "secondary"
    },
    {
      "k": "firewood at home",
      "t": "firewood at home",
      "df": 2,
      "tf": 2,
      "n": 3,
      "score": 0.633016,
      "why": "secondary"
    },
    {
      "k": "wind",
      "t": "wind",
      "df": 5,
      "tf": 7,
      "n": 1,
      "score": 0.624156,
      "why": ""
    },
    {
      "k": "sunny",
      "t": "sunny",
      "df": 3,
      "tf": 3,
      "n": 1,
      "score": 0.621901,
      "why": ""
    },
    {
      "k": "pine",
      "t": "pine",
      "df": 3,
      "tf": 3,
      "n": 1,
      "score": 0.621901,
      "why": ""
    },
    {
      "k": "ground",
      "t": "ground",
      "df": 4,
      "tf": 6,
      "n": 1,
      "score": 0.616826,
      "why": ""
    }
  ],
  "N": 5,
  "total": 130,
  "excluded": [
    {
      "k": "kiln",
      "by": "kiln drying lumber"
    }
  ],
  "flesch": [
    85,
    85,
    87,
    81,
    84
  ],
  "flesch5": 83,
  "words": [
    273,
    249,
    246,
    223,
    205
  ],
  "countIn": [
    [
      2,
      3,
      1
    ],
    [
      2,
      2,
      0
    ],
    [
      3,
      1,
      1
    ],
    [
      2,
      1,
      1
    ],
    [
      2,
      1,
      1
    ]
  ],
  "score": [
    {
      "score": 86,
      "used": [
        "moisture meter",
        "season firewood",
        "creosote"
      ]
    },
    {
      "score": 86,
      "used": [
        "moisture meter",
        "season firewood",
        "creosote"
      ]
    },
    {
      "score": 86,
      "used": [
        "moisture meter",
        "season firewood",
        "kiln"
      ]
    },
    {
      "score": 86,
      "used": [
        "moisture meter",
        "season firewood",
        "creosote"
      ]
    },
    {
      "score": 86,
      "used": [
        "moisture meter",
        "season firewood",
        "kiln"
      ]
    }
  ],
  "questions": [
    {
      "q": "How to Dry Firewood Fast?",
      "key": "how to dry firewood fast",
      "from": [
        "Competitor 1"
      ],
      "heading": true
    },
    {
      "q": "Why seasoning firewood matters?",
      "key": "why seasoning firewood matter",
      "from": [
        "Competitor 1"
      ],
      "heading": true
    },
    {
      "q": "How long does it take to season firewood?",
      "key": "how long does it take to season firewood",
      "from": [
        "Competitor 1"
      ],
      "heading": true
    },
    {
      "q": "How long should firewood season?",
      "key": "how long should firewood season",
      "from": [
        "Competitor 2"
      ],
      "heading": true
    },
    {
      "q": "How to Dry Firewood Quickly?",
      "key": "how to dry firewood quickly",
      "from": [
        "Competitor 3"
      ],
      "heading": true
    },
    {
      "q": "Can you dry firewood in a kiln?",
      "key": "can you dry firewood in a kiln",
      "from": [
        "Competitor 3"
      ],
      "heading": true
    },
    {
      "q": "Does wood dry faster in summer?",
      "key": "does wood dry faster in summer",
      "from": [
        "Competitor 3"
      ],
      "heading": true
    },
    {
      "q": "What is seasoned firewood?",
      "key": "what is seasoned firewood",
      "from": [
        "Competitor 4"
      ],
      "heading": true
    },
    {
      "q": "How to stack firewood for drying?",
      "key": "how to stack firewood for drying",
      "from": [
        "Competitor 4"
      ],
      "heading": true
    },
    {
      "q": "How long to dry firewood?",
      "key": "how long to dry firewood",
      "from": [
        "Competitor 4"
      ],
      "heading": true
    },
    {
      "q": "How to Season Wood for Your Stove?",
      "key": "how to season wood for your stove",
      "from": [
        "Competitor 5"
      ],
      "heading": true
    },
    {
      "q": "How long to season firewood?",
      "key": "how long to season firewood",
      "from": [
        "Competitor 5"
      ],
      "heading": true
    },
    {
      "q": "Is your wood ready?",
      "key": "is your wood ready",
      "from": [
        "Competitor 1"
      ],
      "heading": false
    }
  ],
  "bible": {
    "refs": [
      "John 3:16",
      "Psalm 23",
      "1 Corinthians 13:4–7"
    ],
    "books": [
      "John",
      "Psalms",
      "1 Corinthians",
      "Genesis"
    ]
  },
  "termKey": [
    "dry firewood quickly",
    "moisture meter"
  ],
  "grades": [
    "A+",
    "B+",
    "B+",
    "C",
    "F"
  ]
}

const r6 = (x: number): number => Math.round(x * 1e6) / 1e6

function run() {
  const ctx: Ctx = { forms: new Map(), caps: new Map() }
  const comps = CORPUS.pages.map(p => buildSource({ label: p.label, url: p.url, rank: p.rank, title: p.title, desc: p.desc }, p.blocks, ctx))
  const ais = [buildSource({ label: 'AI Overview' }, CORPUS.aiText.split(/\n+/).map((t): Block => ['p', t]), ctx)]
  const cands = buildCandidates(comps.filter(c => c.words > 0), ais, ctx, CORPUS.topic + '. ' + CORPUS.primary, { primary: CORPUS.primary, rules: { ...RULES_DEFAULT }, secondary: CORPUS.secondary, rich: '', avoid: CORPUS.avoid })
  cands.list = mixOrder(cands.list, comps, RULES_DEFAULT)
  return { comps, ais, cands }
}

describe('engine equals the original Artifact engine on a fixed corpus', () => {
  const { comps, ais, cands } = run()
  it('candidates', () => {
    expect(cands.list.slice(0, 25).map(c => ({ k: c.k, t: c.t, df: c.df, tf: c.tf, n: c.n, score: r6(c.score), why: c.why }))).toEqual(GOLDEN.first25)
    expect(cands.N).toBe(GOLDEN.N)
    expect(cands.list.length).toBe(GOLDEN.total)
    expect(cands.excluded.map(x => ({ k: x.k, by: x.by }))).toEqual(GOLDEN.excluded)
  })
  it('per page measures', () => {
    expect(comps.map(c => c.flesch)).toEqual(GOLDEN.flesch)
    expect(flesch(comps[0].blocks.slice(0, 2))).toBe(GOLDEN.flesch5)
    expect(comps.map(c => c.words)).toEqual(GOLDEN.words)
    expect(comps.map(c => ['dry firewood', 'moisture meter', 'season firewood'].map(k => countIn(c, k)))).toEqual(GOLDEN.countIn)
  })
  it('scoreAgainst', () => {
    const terms: Term[] = [
      { t: 'moisture meter', key: 'moisture meter', tier: 'high' },
      { t: 'seasoning firewood', key: 'season firewood', tier: 'medium' },
      { t: 'creosote', key: 'creosote', tier: 'low', altKeys: ['chimney fire'] },
      { t: 'kilns', key: 'kiln', tier: 'low' },
    ]
    expect(comps.map(c => { const s = scoreAgainst(c, terms); return { score: s.score, used: [...s.used] } })).toEqual(GOLDEN.score)
  })
  it('questions, bible references, keys, grades', () => {
    expect(extractQuestions([...comps, ...ais]).map(q => ({ q: q.q, key: q.key, from: q.from, heading: q.heading }))).toEqual(GOLDEN.questions)
    const b = bibleRefs('Read John 3:16 and Psalm 23 today, then 1 Corinthians 13:4-7 for love. Genesis is the first book.')
    expect({ refs: b.refs, books: [...b.books] }).toEqual(GOLDEN.bible)
    expect([termKey('Dry Firewood Quickly'), termKey('moisture meters')]).toEqual(GOLDEN.termKey)
    expect([[100, 60], [50, 60], [30, 0], [20, 40], [5, 80]].map(([s, t]) => letterGrade(s, t))).toEqual(GOLDEN.grades)
  })
})

describe('small pieces', () => {
  it('stem', () => {
    expect(stem('boxes')).toBe('box')
    expect(stem('cities')).toBe('city')
    expect(stem('news')).toBe('news')
    expect(stem('children')).toBe('child')
    expect(stem('the')).toBe('the')
    expect(STOP.has('the')).toBe(true)
  })
  it('tokenize', () => {
    const [seg] = tokenize('Well-known tools; it’s fine')
    expect(seg.sf).toEqual(['well', 'known', 'tools'])
    expect(seg.hy).toEqual([true, false, false])
    expect(tokenize('see https://x.example/a now')[0].sf).toEqual(['see', 'now'])
    expect(tokenize('')).toEqual([])
  })
  it('termKey and countWords', () => {
    expect(termKey('Seasoned Logs')).toBe('seasoned log')
    expect(termKey('')).toBe('')
    expect(countWords("It’s a dry-wood day")).toBe(5)
    expect(countWords(null)).toBe(0)
  })
  it('flesch and its label', () => {
    expect(flesch([['p', 'Too short.']])).toBeNull()
    expect(flesch([['h2', 'Heading only']])).toBeNull()
    expect(fleschLabel(null)).toBe('-')
    expect(fleschLabel(95)).toBe('Very easy')
    expect(fleschLabel(10)).toBe('Very difficult')
  })
  it('makeAvoidTest', () => {
    const none = makeAvoidTest('', 'firewood')
    expect(none('anything')).toBe('')
    const test = makeAvoidTest('kiln drying lumber', 'how to dry firewood')
    expect(test('kiln drying lumber')).toBe('kiln drying lumber')
    expect(test('dry firewood')).toBe('')
  })
  it('urls, ids, stats', () => {
    expect(hostOf('https://www.Example.com/a')).toBe('example.com')
    expect(hostOf('nope')).toBe('')
    expect(normUrl('https://www.Example.com/Path/')).toBe('example.com/path')
    expect(normUrl(' Not A Url ')).toBe('not a url')
    expect(hashId('abc')).toBe(hashId('abc'))
    expect(hashId('abc')).not.toBe(hashId('abd'))
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(3)
    expect(median([])).toBe(0)
    expect(pct([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(pct([], 0.5)).toBe(0)
  })
  it('letterGrade cut-offs', () => {
    expect(letterGrade(35, 0)).toBe('A+')
    expect(letterGrade(0, 0)).toBe('F')
    expect(letterGrade(35 * 0.93, 0)).toBe('A')
    expect(letterGrade(35 * 0.32, 0)).toBe('D')
    expect(letterGrade(10, 0)).toBe('F')
  })
})
