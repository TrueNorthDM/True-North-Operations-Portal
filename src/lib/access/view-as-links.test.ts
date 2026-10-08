import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * A View Stage preview lives in the address (?_vs=...). A navigation made in
 * code (router.push / router.replace) that drops it renders the next page as
 * the real Super Admin inside a column labelled with another level: the
 * preview then shows more than that level sees (audit, 8 October 2026). So
 * every one of them goes through withViewAs (components/ViewAsKeeper.tsx).
 */

const SRC = join(__dirname, '..', '..')
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  if (statSync(p).isDirectory()) return f === 'design-check' ? [] : files(p)
  return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : []
})

describe('navigations in code keep a View Stage preview', () => {
  it('wrap every router.push and router.replace in withViewAs', () => {
    const bare = files(SRC)
      .filter(f => !f.endsWith('ViewAsKeeper.tsx')) // the keeper adds the token itself
      .flatMap(f => readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${relative(SRC, f)}:${i + 1}` }))
        .filter(({ line }) => /router\.(push|replace)\(/.test(line) && !/router\.(push|replace)\(withViewAs\(/.test(line)))
      .map(x => x.at)
    expect(bare).toEqual([])
  })

  it('never send the browser elsewhere by assigning window.location', () => {
    const assigned = files(SRC)
      .filter(f => /window\.location\.(href|assign|replace)\s*[=(]/.test(readFileSync(f, 'utf8')))
      .map(f => relative(SRC, f))
    expect(assigned).toEqual([])
  })
})
