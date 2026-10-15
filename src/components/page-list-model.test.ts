import { describe, it, expect } from 'vitest'
import type { PageListRow } from '@/lib/href-links/data'
import {
  filterAndSort, langFilterLabel, parseLangs, patchQuery, readView, sortPatch,
  splitIntoGroups, statusCounts, toggledLangs, urlCountOf,
} from './page-list-model'

const LANGS = ['en', 'es']
const row = (id: string, over: Partial<PageListRow> = {}): PageListRow => ({
  id, name: `Page ${id}`,
  langStatus: { en: { hasUrl: true, confirmed: true }, es: { hasUrl: false, confirmed: false } },
  done: false,
  ...over,
})
const view = (over: Partial<Parameters<typeof filterAndSort>[2]> = {}) => ({
  search: '', status: 'all' as const, hasLangs: [], sortKey: 'name' as const, sortDir: 'asc' as const,
  ...over,
})

describe('page-list-model', () => {
  it('reads the view from the URL, unknown values falling back to the default', () => {
    expect(readView(new URLSearchParams('status=done&sort=all_live&dir=desc&lang=es')))
      .toEqual({ status: 'done', langParam: 'es', sortKey: 'all_live', sortDir: 'desc' })
    expect(readView(new URLSearchParams('status=nope&sort=nope&dir=up')))
      .toEqual({ status: 'all', langParam: '', sortKey: 'name', sortDir: 'asc' })
  })

  it('keeps only the site languages from the lang param', () => {
    expect(parseLangs(' es ,xx,en', LANGS)).toEqual(['es', 'en'])
    expect(parseLangs('', LANGS)).toEqual([])
  })

  it('drops empty values from the query', () => {
    expect(patchQuery('status=done&lang=en', { status: null, lang: '', sort: 'all_live' })).toBe('sort=all_live')
  })

  it('cycles a sort header: asc, desc, then back to the default', () => {
    expect(sortPatch('all_live', 'name', 'asc')).toEqual({ sort: 'all_live', dir: null })
    expect(sortPatch('all_live', 'all_live', 'asc')).toEqual({ sort: 'all_live', dir: 'desc' })
    expect(sortPatch('all_live', 'all_live', 'desc')).toEqual({ sort: null, dir: null })
  })

  it('flips one language and labels the selection', () => {
    expect(toggledLangs(['en'], 'es')).toEqual(['en', 'es'])
    expect(toggledLangs(['en', 'es'], 'en')).toEqual(['es'])
    expect(langFilterLabel([])).toBe('All')
    expect(langFilterLabel(['es'])).toBe('ES')
    expect(langFilterLabel(['en', 'es'])).toBe('2 selected')
  })

  it('filters by search, status and language', () => {
    const rows = [row('1'), row('2', { done: true }), row('3', { name: 'Other', notRelevant: true, done: true })]
    expect(filterAndSort(rows, LANGS, view({ search: 'page' })).map(r => r.id)).toEqual(['1', '2'])
    expect(filterAndSort(rows, LANGS, view({ status: 'incomplete' })).map(r => r.id)).toEqual(['1'])
    expect(filterAndSort(rows, LANGS, view({ status: 'not_relevant' })).map(r => r.id)).toEqual(['3'])
    expect(filterAndSort(rows, LANGS, view({ hasLangs: ['es'] }))).toEqual([])
  })

  it('sorts names numerically and puts undated pages last in ascending order', () => {
    const rows = [row('10'), row('2'), row('1', { confirmedDoneAt: '2026-09-01T00:00:00Z' })]
    expect(filterAndSort(rows, LANGS, view()).map(r => r.id)).toEqual(['1', '2', '10'])
    expect(filterAndSort(rows, LANGS, view({ sortKey: 'all_live' })).map(r => r.id)).toEqual(['1', '2', '10'])
    expect(filterAndSort(rows, LANGS, view({ sortKey: 'all_live', sortDir: 'desc' })).map(r => r.id)).toEqual(['2', '10', '1'])
  })

  it('counts links, groups and statuses', () => {
    const full = row('1', { langStatus: { en: { hasUrl: true, confirmed: false }, es: { hasUrl: true, confirmed: false } } })
    expect(urlCountOf(row('2'), LANGS)).toBe(1)
    const groups = splitIntoGroups([full, row('2'), row('3', { done: true }), row('4', { notRelevant: true })], LANGS)
    expect(Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map(r => r.id)])))
      .toEqual({ ready: ['1'], ongoing: ['2'], completed: ['3'], not_relevant: ['4'] })
    expect(statusCounts([row('1', { needsUpdate: true }), row('2', { done: true, notRelevant: true })]))
      .toEqual({ done: 1, incomplete: 1, needsUpdate: 1, notRelevant: 1 })
  })
})
