// My Work — sample dataset. This screen is meant to show everything assigned to
// the signed-in person across the Monday account; until that integration is
// wired, it renders this in-repo sample so the design is live and testable.
// Swap TASKS (and derive PEOPLE/projects) for the Monday pull when ready.

export type Prio = 'high' | 'med' | 'low'
export type Status = 'todo' | 'doing' | 'review' | 'done'

export interface Task {
  id: number
  title: string
  project: string
  prio: Prio
  due: string
  dueSoon: boolean
  who: string // PEOPLE key (initials)
  status: Status
}

export interface Person {
  name: string
  bg: string
  fg: string
}

// Project → dot colour (brand-fixed; reads on both themes).
export const PROJECT_COLOR: Record<string, string> = {
  AAAF: '#A9C0DE',
  HFA: '#2a5cab',
  'i7 Marketing': '#012358',
  'SEO Sprints': '#F2C40A',
  Translation: '#94C4C5',
  Editorial: '#1E7D7F',
}

export const PEOPLE: Record<string, Person> = {
  AO: { name: 'Arnaldo Oliveira', bg: '#012358', fg: '#ffffff' },
  EM: { name: 'Elias Moraes', bg: '#F2C40A', fg: '#012358' },
  JR: { name: 'Joana Ribeiro', bg: '#1E7D7F', fg: '#ffffff' },
  DC: { name: 'Daniel Costa', bg: '#A9C0DE', fg: '#012358' },
  LF: { name: 'Lucía Fernández', bg: '#94C4C5', fg: '#16332e' },
  MB: { name: 'Marco Bianchi', bg: '#2a5cab', fg: '#ffffff' },
}

export const TASKS: Task[] = [
  { id: 1, title: 'Publish June hreflang batch', project: 'AAAF', prio: 'high', due: 'Jun 12', dueSoon: true, who: 'JR', status: 'review' },
  { id: 2, title: 'Fix canonical tags across blog', project: 'SEO Sprints', prio: 'med', due: 'Jun 10', dueSoon: true, who: 'EM', status: 'doing' },
  { id: 3, title: 'Translate 6 landing pages to ES', project: 'Translation', prio: 'med', due: 'Jun 14', dueSoon: true, who: 'LF', status: 'doing' },
  { id: 4, title: 'i7 monthly budget usage report', project: 'i7 Marketing', prio: 'high', due: 'Jun 30', dueSoon: false, who: 'AO', status: 'todo' },
  { id: 5, title: 'Rebuild HFA homepage hero section', project: 'HFA', prio: 'med', due: 'Jun 18', dueSoon: false, who: 'DC', status: 'todo' },
  { id: 6, title: 'QA Italian translations', project: 'Translation', prio: 'low', due: 'Jun 9', dueSoon: true, who: 'MB', status: 'review' },
  { id: 7, title: 'Keyword research for Q3 campaign', project: 'SEO Sprints', prio: 'med', due: 'Jun 20', dueSoon: false, who: 'EM', status: 'todo' },
  { id: 8, title: 'Client check-in deck for i7', project: 'i7 Marketing', prio: 'med', due: 'Jun 15', dueSoon: false, who: 'AO', status: 'doing' },
  { id: 9, title: 'Approve June editorial calendar', project: 'Editorial', prio: 'high', due: 'Jun 8', dueSoon: true, who: 'JR', status: 'done' },
  { id: 10, title: 'Update WordPress plugins — AAAF', project: 'AAAF', prio: 'low', due: 'Jun 7', dueSoon: true, who: 'DC', status: 'done' },
]
