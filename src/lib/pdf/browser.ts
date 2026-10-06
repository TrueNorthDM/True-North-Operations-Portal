/**
 * The headless Chromium behind the PDF and image exports (the i7 PDF, the i7
 * image and the Report PDF).
 *
 * Two places it can come from, in this order:
 *   - CHROME_PATH: the Chromium installed in the portal's image on its server
 *     (deploy/portal/Dockerfile).
 *   - Local development: the desktop Chrome, or LOCAL_CHROME_PATH.
 */

import puppeteer, { type Browser } from 'puppeteer-core'

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
