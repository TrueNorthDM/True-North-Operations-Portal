/**
 * The headless Chromium behind the PDF and image exports (the i7 PDF, the i7
 * image and the Report PDF).
 *
 * Three places it can come from, in this order:
 *   - CHROME_PATH: a Chromium installed on the server. The portal's own server
 *     (migration plan, step p4-chrome) sets it; nothing else does.
 *   - Local development: the desktop Chrome, or LOCAL_CHROME_PATH.
 *   - Vercel: the serverless build bundled with @sparticuz/chromium.
 */

import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

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
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}
