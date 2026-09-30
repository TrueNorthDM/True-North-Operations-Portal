import { describe, it, expect } from 'vitest'
import { switchOverAction } from './switch-over'

const get = (pathname: string, env: Record<string, string> = {}, search = '') =>
  switchOverAction({ method: 'GET', pathname, search, env })

describe('switchOverAction', () => {
  it('does nothing while both switches are off', () => {
    expect(get('/')).toBeNull()
    expect(get('/api/cron/ingest')).toBeNull()
    expect(get('/ops/client-reports/i7', { MAINTENANCE_MODE: '0', LEGACY_REDIRECT_TO: '' })).toBeNull()
  })

  describe('maintenance', () => {
    const env = { MAINTENANCE_MODE: '1' }

    it('shows the maintenance page for every page', () => {
      expect(get('/', env)).toEqual({ kind: 'maintenance-page' })
      expect(get('/directory', env)).toEqual({ kind: 'maintenance-page' })
      expect(get('/login', env)).toEqual({ kind: 'maintenance-page' })
    })

    it('lets the maintenance page itself render', () => {
      expect(get('/maintenance', env)).toBeNull()
    })

    it('stops API routes, so cron jobs and webhooks change nothing', () => {
      expect(get('/api/cron/ingest', env)).toEqual({ kind: 'unavailable', status: 503 })
      expect(switchOverAction({ method: 'POST', pathname: '/api/monday/webhook/x', search: '', env }))
        .toEqual({ kind: 'unavailable', status: 503 })
    })

    it('refuses form posts and server actions on pages', () => {
      expect(switchOverAction({ method: 'POST', pathname: '/profile', search: '', env }))
        .toEqual({ kind: 'unavailable', status: 503 })
    })

    it('accepts the usual ways of saying on', () => {
      for (const v of ['true', 'ON', ' yes ']) expect(get('/', { MAINTENANCE_MODE: v })).toEqual({ kind: 'maintenance-page' })
    })
  })

  describe('redirect to the new address', () => {
    const env = { LEGACY_REDIRECT_TO: 'https://truenorthportal.online' }

    it('keeps the path and the query', () => {
      expect(get('/ops/client-reports/i7', env, '?month=2026-09'))
        .toEqual({ kind: 'redirect', location: 'https://truenorthportal.online/ops/client-reports/i7?month=2026-09' })
    })

    it('uses only the origin of the setting', () => {
      expect(get('/', { LEGACY_REDIRECT_TO: 'https://truenorthportal.online/whatever/' }))
        .toEqual({ kind: 'redirect', location: 'https://truenorthportal.online/' })
    })

    it('answers 410 to Vercel cron calls instead of passing them on', () => {
      expect(get('/api/cron/tsheets-sync', env)).toEqual({ kind: 'unavailable', status: 410 })
    })

    it('wins over maintenance', () => {
      expect(get('/', { ...env, MAINTENANCE_MODE: '1' })?.kind).toBe('redirect')
    })

    it('stays off for anything that is not an https address', () => {
      expect(get('/', { LEGACY_REDIRECT_TO: 'truenorthportal.online' })).toBeNull()
      expect(get('/', { LEGACY_REDIRECT_TO: 'http://truenorthportal.online' })).toBeNull()
    })
  })
})
