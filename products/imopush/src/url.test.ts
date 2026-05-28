import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalImopushUrl = process.env.NEXT_PUBLIC_IMOPUSH_URL

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_IMOPUSH_URL
  vi.resetModules()
})

afterEach(() => {
  if (originalImopushUrl === undefined) {
    delete process.env.NEXT_PUBLIC_IMOPUSH_URL
  } else {
    process.env.NEXT_PUBLIC_IMOPUSH_URL = originalImopushUrl
  }
})

async function freshUrl() {
  // `productUrl` reads NEXT_PUBLIC_IMOPUSH_URL at call time, not at
  // module load, so we don't need to reset modules to test env changes —
  // a fresh import is enough.
  return await import('./url')
}

describe('IMOPUSH_PATHS', () => {
  it('owns every static imopush route as a single source of truth', async () => {
    const { IMOPUSH_PATHS } = await freshUrl()
    expect(IMOPUSH_PATHS.dashboard).toBe('/imopush/dashboard')
    expect(IMOPUSH_PATHS.newProperty).toBe('/imopush/dashboard/p/new')
  })

  it('builds property and integrator paths from their dynamic params', async () => {
    const { IMOPUSH_PATHS } = await freshUrl()
    expect(IMOPUSH_PATHS.property('AB-123')).toBe('/imopush/dashboard/p/AB-123')
    expect(IMOPUSH_PATHS.integrator('idealista')).toBe(
      '/imopush/dashboard/integrators/idealista',
    )
  })
})

describe('absolute URL builders', () => {
  it('defaults to https://imopush.iedora.com when NEXT_PUBLIC_IMOPUSH_URL is unset', async () => {
    const url = await freshUrl()
    expect(url.imopushUrl()).toBe('https://imopush.iedora.com')
    expect(url.imopushDashboardUrl()).toBe(
      'https://imopush.iedora.com/dashboard',
    )
    expect(url.imopushNewPropertyUrl()).toBe(
      'https://imopush.iedora.com/dashboard/p/new',
    )
    expect(url.imopushPropertyUrl('R42')).toBe(
      'https://imopush.iedora.com/dashboard/p/R42',
    )
    expect(url.imopushIntegratorUrl('idealista')).toBe(
      'https://imopush.iedora.com/dashboard/integrators/idealista',
    )
  })

  it('honours NEXT_PUBLIC_IMOPUSH_URL for dev / per-env overrides (path-based)', async () => {
    process.env.NEXT_PUBLIC_IMOPUSH_URL = 'http://localhost:3000/imopush'
    const url = await freshUrl()
    expect(url.imopushUrl()).toBe('http://localhost:3000/imopush')
    // In dev, NEXT_PUBLIC_IMOPUSH_URL already carries the `/imopush`
    // prefix because there are no subdomains locally — so the final
    // URL ends up shaped exactly like an in-product Next path.
    expect(url.imopushDashboardUrl()).toBe(
      'http://localhost:3000/imopush/dashboard',
    )
  })
})
