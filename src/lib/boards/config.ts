/**
 * boards/config.ts
 *
 * Board configuration + label semantics for the Boards Review section, ported
 * verbatim from the COE Dashboard (index.html). This is pure data + helpers —
 * no UI, no I/O — so it's shared by both the server (snapshot enrichment) and
 * the client (rendering).
 *
 * Phase B note: this replaces the inline `BOARDS` / `LABEL_SEMANTICS` constants
 * the legacy boards.html still uses. Keep the two in sync until cutover (B6).
 */

/** Activity-log window fetched from Monday (days). Balances Custom-filter
 *  coverage against payload size; the dashboard's longest period is ~90d. */
export const ACTIVITY_LOG_DAYS = 180

export interface BoardStage {
  col: string
  name: string
  /** Owner is always this person (e.g. a fixed coordinator). */
  ownerFixed?: string
  /** Owner is read from this people column. */
  ownerCol?: string
  /** Stage only exists when the gate column is NOT at `skipIf`. */
  gate?: { col: string; skipIf: string }
  /** Stage only exists when `col` equals `value` (e.g. only ES editing if Spanish=Yes). */
  requires?: { col: string; value: string }
}

export interface SubitemPipeline {
  /** Column on the subitem that names its language. */
  languageCol: string
  stages: BoardStage[]
  /** All people columns considered responsible for a subitem. */
  peopleCols: string[]
}

export interface BoardConfig {
  name: string
  short: string
  /** Group whose items count as "work started" (Translation boards). */
  workStartGroup?: string
  stages: BoardStage[]
  subitemPipeline?: SubitemPipeline
  peopleCols: string[]
  dateCol: string
  // ----- Publishing-mode fields (HFA-P / AAAF-P) -----
  publishingMode?: boolean
  languageCol?: string
  publisherCol?: string
  publishedCol?: string
  publishedLabel?: string
  /** Groups excluded from the "Not Published" KPI (already published / out of scope). */
  excludedGroups?: string[]
}

/**
 * Explicit board map.
 *   stages   = pipeline order (first non-complete stage = item's current stage)
 *   gate     = stage exists only when the gate column is NOT at skipIf
 *   requires = stage exists only when the requires column equals value
 *   peopleCols = every people column considered responsible for the item
 */
export const BOARDS: Record<string, BoardConfig> = {
  '9050569288': {
    name: 'AAAF · Translations',
    short: 'AAAF-T',
    workStartGroup: 'On Going',
    stages: [
      { col: 'status3__1', name: 'Kick-Off', ownerFixed: 'Joy Deche' },
      { col: 'status_mkm1m1x4', name: 'Assign', ownerFixed: 'Joy Deche' },
      { col: 'status9__1', name: 'Adapt Content', ownerCol: 'people2__1' },
      { col: 'color_mkrmmn0r', name: 'GPT Setup', ownerCol: 'multiple_person_mkrm7206' },
      { col: 'status4__1', name: 'Design', ownerCol: 'people6__1', gate: { col: 'status81__1', skipIf: 'Not Needed' } },
    ],
    subitemPipeline: {
      languageCol: 'status',
      stages: [
        { col: 'status11__1', name: 'GPT Translation', ownerCol: 'people2__1' },
        { col: 'color_mkr4eb5w', name: 'Translated Doc', ownerCol: 'multiple_person_mkr4jrwk' },
        { col: 'status1__1', name: 'Proof Page', ownerCol: 'people8__1' },
        { col: 'status_mkm1k3gm', name: 'Page Editing', ownerCol: 'multiple_person_mktmq7tp' },
      ],
      peopleCols: ['people2__1', 'multiple_person_mkr4jrwk', 'people8__1', 'multiple_person_mktmq7tp'],
    },
    peopleCols: ['people_mkm1wy1v', 'people2__1', 'multiple_person_mkrm7206', 'people6__1'],
    dateCol: 'date6__1',
  },
  '7903847600': {
    name: 'HFA · Translations',
    short: 'HFA-T',
    workStartGroup: 'On Going',
    stages: [
      { col: 'status3__1', name: 'Kick-Off', ownerFixed: 'Joy Deche' },
      { col: 'status_mkm1m1x4', name: 'Assign', ownerFixed: 'Joy Deche' },
      { col: 'status9__1', name: 'Adapt Content', ownerCol: 'people2__1' },
      { col: 'color_mkrmt3jm', name: 'GPT Setup', ownerCol: 'multiple_person_mkrmaekz' },
      { col: 'status4__1', name: 'Design', ownerCol: 'people6__1', gate: { col: 'status81__1', skipIf: 'Not Needed' } },
    ],
    subitemPipeline: {
      languageCol: 'status',
      stages: [
        { col: 'status11__1', name: 'GPT Translation', ownerCol: 'people2__1' },
        { col: 'color_mkr3pdpx', name: 'Translated Doc', ownerCol: 'multiple_person_mkr37nq9' },
        { col: 'status1__1', name: 'Proof Page', ownerCol: 'people8__1' },
        { col: 'status_mkm1r1s5', name: 'Language Editing', ownerCol: 'people_mkm18azx' },
      ],
      peopleCols: ['people2__1', 'multiple_person_mkr37nq9', 'people8__1', 'people_mkm18azx'],
    },
    peopleCols: ['people_mkm1wy1v', 'people2__1', 'multiple_person_mkrmaekz', 'people6__1'],
    dateCol: 'date6__1',
  },
  '6691665827': {
    name: 'HFA · Publishing',
    short: 'HFA-P',
    stages: [
      { col: 'status33', name: 'Staging' },
      { col: 'status01', name: 'Proofing' },
      { col: 'color_mkrmdf52', name: 'Implementation' },
      { col: 'status6', name: 'Internal Linking' },
      { col: 'status31', name: 'Publishing' },
    ],
    peopleCols: ['people', 'people_1', 'multiple_person_mkrmyset', 'people2', 'people29'],
    dateCol: 'date10',
    publishingMode: true,
    languageCol: 'status_Mjj4VcPh',
    publisherCol: 'people29',
    publishedCol: 'status31',
    publishedLabel: 'Done',
    excludedGroups: ['Published', 'French - Unpublished'],
  },
  '462251934': {
    name: 'AAAF · Publishing',
    short: 'AAAF-P',
    stages: [
      { col: 'status33', name: 'Staging' },
      { col: 'status01', name: 'Proofing' },
      { col: 'status56', name: 'Implementation' },
      { col: 'status6', name: 'Internal Linking' },
      { col: 'status31', name: 'Publishing' },
    ],
    peopleCols: ['people', 'people_1', 'people2', 'people31', 'people30', 'people29'],
    dateCol: 'date10',
    publishingMode: true,
    languageCol: 'color_mkqr7s1t',
    publisherCol: 'people29',
    publishedCol: 'status31',
    publishedLabel: 'Done',
    excludedGroups: ['Published'],
  },
}

/** Publishers that count toward the Publishing dashboard metric. Exact,
 *  case-insensitive match against the full name (substring matching caused
 *  false positives). */
export const PUBLISHERS = ['Samuel Manzi', 'Wendy Cacka'] as const

export function isPublisher(name: string | null | undefined): boolean {
  const n = String(name || '').trim().toLowerCase()
  return PUBLISHERS.some((p) => p.toLowerCase() === n)
}

/** What each status label means in the workflow. */
export type LabelSemantic = 'complete' | 'skipped' | 'active' | 'notstarted' | 'stuck' | 'waiting'

export const LABEL_SEMANTICS: Record<string, LabelSemantic> = {
  Done: 'complete',
  Yes: 'complete',
  "Let's Do it!": 'complete',
  Activated: 'complete',
  Published: 'complete',
  'Work complete': 'complete',
  'Not Relevant': 'skipped',
  'Not Needed': 'skipped',
  'Swahili Only': 'skipped',
  'Working on it': 'active',
  'Being Translated': 'active',
  'Being Revised': 'active',
  'Re-Worked': 'active',
  'New Language': 'active',
  "Hasn't Started Yet": 'active',
  Stuck: 'stuck',
  'On Hold': 'stuck',
  UNKNOWN: 'stuck',
  'DO NOT USE': 'stuck',
  'Waiting / 2nd Language': 'waiting',
  'Waiting / 2nd Link': 'waiting',
  'With Interns': 'waiting',
  'New In': 'notstarted',
}

export function labelSemantic(label: string | null | undefined): LabelSemantic {
  if (!label) return 'notstarted'
  return LABEL_SEMANTICS[label] || 'notstarted'
}

/** Board IDs that run in publishing mode (the Goals view). */
export const PUBLISHING_BOARD_IDS = Object.keys(BOARDS).filter((id) => BOARDS[id].publishingMode)
