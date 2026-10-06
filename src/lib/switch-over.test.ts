import { describe, it, expect } from 'vitest'
import { switchOverAction } from './switch-over'

const get = (pathname: string, env: Record<string, string> = {}, search = '') =>
  switchOverAction({ method: 'GET', pathname, search, env })

describe('switchOverAction', () => {
  it('does nothing while the switch is off', () => {
    expect(get('/')).toBeNull()
    expect(get('/api/cron/ingest')).toBeNull()
    expect(get('/ops/client-reports/i7', { MAINTENANCE_MODE: '0' })).toBeNull()
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
})
