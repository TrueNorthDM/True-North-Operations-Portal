/**
 * The headless Chromium behind the PDF and image exports (the i7 PDF, the i7
 * image and the Report PDF).
 *
 * Two places it can come from, in this order:
 *   - CHROME_PATH: the Chromium installed in the portal's image on its server
 *     (deploy/portal/Dockerfile).
 *   - Local development: the desktop Chrome, or LOCAL_CHROME_PATH.
 */

import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const SAFE_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

export async function launchBrowser(): Promise<Browser> {
  const serverChrome = process.env.CHROME_PATH
  if (serverChrome) {
    return puppeteer.launch({ executablePath: serverChrome, headless: true, args: SAFE_ARGS })
  }
  if (process.env.NODE_ENV !== 'production') {
    const executablePath = process.env.LOCAL_CHROME_PATH
      || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    return puppeteer.launch({ executablePath, headless: true, args: SAFE_ARGS })
  }
  throw new Error('No Chromium for exports: CHROME_PATH is not set.')
}

/**
 * Sends `headers` (the caller's cookie, or a print pass) only with requests to
 * the page's own origin, the portal itself (security audit, 8 November 2026).
 * Before, every request the page made carried the session, so an image or a
 * font from anywhere else would have received it too. Other requests still
 * load, just without it.
 */
export async function sendOnlyToOrigin(page: Page, target: string | URL, headers: Record<string, string>): Promise<void> {
  if (!Object.keys(headers).length) return
  const origin = new URL(target).origin
  await page.setRequestInterception(true)
  page.on('request', req => {
    let same = false
    try { same = new URL(req.url()).origin === origin } catch { same = false }
    void (same ? req.continue({ headers: { ...req.headers(), ...headers } }) : req.continue())
  })
}
