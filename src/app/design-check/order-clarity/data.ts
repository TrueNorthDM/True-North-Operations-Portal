// The SEO team's order on 18 September 2026, read from production: each row's
// place in the team's order, its place in True North's order, and whether
// Jeannette placed it by hand. 777 open steps, 190 placed by hand, the first
// 169 of the team's order all placed by hand. Design check only.

export interface OrderRow {
  team: number
  tn: number
  placed: boolean
  /** Steps placed by hand above this one in the team's order. */
  placedAbove: number
  item: string
  language?: string
  board: string
  step: string
  who: string
  status?: string
  colour?: string
  due?: string | null
}

export const TOTAL = 777
export const PLACED = 190
export const LEADER = 'Jeannette Owens'

/** Jeannette's own list: mostly placed by hand, the last one following True North. */
export const JEANNETTE: OrderRow[] = [
  { team: 1, tn: 296, placed: true, placedAbove: 0, item: 'Technical - Scan 5 / Heading Structure', board: 'WM - Technical Fixes', step: 'Implementation', who: LEADER, status: 'Working on it', colour: '#fdab3d', due: null },
  { team: 2, tn: 295, placed: true, placedAbove: 1, item: 'Technical - Scan 4 / Meta Titles', board: 'WM - Technical Fixes', step: 'Fix', who: LEADER, status: 'Working on It', colour: '#fdab3d', due: null },
  { team: 4, tn: 110, placed: true, placedAbove: 3, item: 'Wood Moisture Meter FAQs (update content to reflect new products)', board: 'BM - Publishing', step: 'On-Page SEO', who: LEADER, status: "Hasn't Started Yet", colour: '#9d50dd', due: 'Sep 21' },
  { team: 5, tn: 96, placed: true, placedAbove: 4, item: 'B122: construction delays caused by moisture', board: 'BM - SEO & Writing', step: 'Brief Draft SEO', who: LEADER, status: 'On Hold', colour: '#7f5347', due: 'Sep 18' },
  { team: 164, tn: 292, placed: true, placedAbove: 163, item: 'Rapid RH and Carbide Bomb: The Pros & Cons of Each', board: 'WM - Schema Audits', step: 'Audit', who: LEADER, status: 'On Hold', colour: '#7f5347', due: null },
  { team: 165, tn: 178, placed: true, placedAbove: 164, item: 'Rapid RH® L6 and 5.0 Smart Sensor Installation', board: 'WM - Schema Audits', step: 'Audit', who: LEADER, status: "Hasn't Started Yet", colour: '#9d50dd', due: 'Sep 30' },
  { team: 192, tn: 46, placed: false, placedAbove: 179, item: '146 - Old covenant vs new covenant', board: 'AAAF - Schema Audits', step: 'Audit', who: LEADER, status: 'Stuck', colour: '#df2f4a', due: 'Aug 28' },
]

/** Arnaldo's own list: every step follows True North, below the 179 placed by hand. */
export const ARNALDO: OrderRow[] = [
  { team: 203, tn: 80, placed: false, placedAbove: 179, item: '128 - How do Adventists view the concept of the end of the world?', language: 'Portuguese', board: 'AAAF - Publishing', step: 'Href Link', who: 'Arnaldo Oliveira', status: 'Stuck', colour: '#df2f4a', due: 'Sep 7' },
  { team: 204, tn: 81, placed: false, placedAbove: 179, item: '128 - How do Adventists view the concept of the end of the world?', language: 'Swahili', board: 'AAAF - Publishing', step: 'Href Link', who: 'Arnaldo Oliveira', status: 'Stuck', colour: '#df2f4a', due: 'Sep 7' },
  { team: 205, tn: 82, placed: false, placedAbove: 179, item: '128 - How do Adventists view the concept of the end of the world?', language: 'Spanish', board: 'AAAF - Publishing', step: 'Href Link', who: 'Arnaldo Oliveira', status: 'Stuck', colour: '#df2f4a', due: 'Sep 7' },
  { team: 207, tn: 88, placed: false, placedAbove: 179, item: 'PP09/21 - Was Ellen White a prophet', language: 'Portuguese', board: 'AAAF - Publishing', step: 'Href Link', who: 'Arnaldo Oliveira', status: 'Stuck', colour: '#df2f4a', due: 'Sep 14' },
  { team: 208, tn: 89, placed: false, placedAbove: 179, item: 'PP09/21 - Was Ellen White a prophet', language: 'Spanish', board: 'AAAF - Publishing', step: 'Href Link', who: 'Arnaldo Oliveira', status: 'Stuck', colour: '#df2f4a', due: 'Sep 14' },
]

/** The editor: the top of the team's order, then where the hand-placed block ends. */
export const EDITOR_TOP: OrderRow[] = [
  { team: 1, tn: 296, placed: true, placedAbove: 0, item: 'Technical - Scan 5 / Heading Structure', board: 'WM - Technical Fixes', step: 'Implementation', who: LEADER },
  { team: 2, tn: 295, placed: true, placedAbove: 1, item: 'Technical - Scan 4 / Meta Titles', board: 'WM - Technical Fixes', step: 'Fix', who: LEADER },
  { team: 3, tn: 258, placed: true, placedAbove: 2, item: 'B116: pin vs pinless moisture meter', board: 'BM - Publishing', step: 'Media', who: 'Stephanie Aguirre' },
  { team: 4, tn: 110, placed: true, placedAbove: 3, item: 'Wood Moisture Meter FAQs (update content to reflect new products)', board: 'BM - Publishing', step: 'On-Page SEO', who: LEADER, due: 'Sep 21' },
]

export const EDITOR_SEAM: OrderRow[] = [
  { team: 169, tn: 230, placed: true, placedAbove: 168, item: 'PP16/02/10 - What Is Intercessory Prayer and How Do I Pray for Others?', board: 'AAAF - SEO & Writing', step: 'Brief Draft SEO', who: 'Kevin Ames', due: 'Oct 9' },
  { team: 170, tn: 1, placed: false, placedAbove: 169, item: 'PP07/23: What Do Adventists Believe about Marriage & Family?', board: 'AAAF - Publishing', step: 'Swiftype', who: 'Kathleen Aguilar', due: 'Apr 22, 2023' },
  { team: 171, tn: 2, placed: false, placedAbove: 169, item: '150 - Who was Mary Magdalene?', board: 'AAAF - Publishing', step: 'Swiftype', who: 'Kathleen Aguilar', due: 'May 13, 2025' },
  { team: 172, tn: 213, placed: true, placedAbove: 169, item: '12D - Examples of Prayer', board: 'AAAF - General Audits', step: 'Audit', who: 'Stephanie Aguirre', due: 'Oct 2' },
  { team: 173, tn: 84, placed: true, placedAbove: 170, item: 'PP14/47 - Book of 2 Corinthians', board: 'AAAF - SEO & Writing', step: 'Media', who: 'Stephanie Aguirre', due: 'Sep 9' },
  { team: 176, tn: 3, placed: false, placedAbove: 173, item: 'PP12/35 - What does it mean to have faith in Jesus?', board: 'AAAF - Schema Audits', step: 'Audit', who: 'Kathleen Aguilar', due: 'Apr 1' },
  { team: 177, tn: 4, placed: false, placedAbove: 173, item: 'PP12/36 - What does it mean to pick up your cross like Jesus?', board: 'AAAF - Schema Audits', step: 'Audit', who: 'Kathleen Aguilar', due: 'Apr 1' },
]
