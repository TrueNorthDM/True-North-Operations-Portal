import type { Metadata, Viewport } from 'next'
import { ViewAsKeeper } from '@/components/ViewAsKeeper'
// The six typefaces and their --font-* variables, self-hosted (see fonts/fonts.ts).
import './fonts/fonts'
import './globals.css'
import { IS_STAGING } from '@/lib/environment'
import { StagingBanner } from '@/components/StagingBanner'

export const metadata: Metadata = {
  title: 'True North Operations Portal',
  description: 'Operations portal for AAAF and HFA, editorial pipeline, publishing goals, and hreflang workflows',
}

/**
 * Navy behind the browser chrome on Android and in an installed window, so the
 * app does not sit under a strip of default grey.
 *
 * The icons themselves are not declared here. `favicon.ico`, `icon.svg` and
 * `apple-icon.png` sit beside this file and Next writes their <link> tags from
 * the filenames, as does `manifest.webmanifest`. Declaring them twice is how
 * they drift.
 */
export const viewport: Viewport = {
  themeColor: '#012358',
}

/**
 * Root layout, minimal shell only.
 * The sidebar + top bar live inside (app)/layout.tsx so they don't show up
 * on /login or /auth/callback.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased${IS_STAGING ? ' staging' : ''}`}>
      {/* suppressHydrationWarning on <body>: browser extensions (e.g. Grammarly)
          inject attributes like data-gr-ext-installed into <body> before React
          hydrates, causing a harmless attribute mismatch. This suppresses the
          warning for <body>'s own attributes only, it does NOT mask real
          hydration bugs deeper in the tree. Nothing to do with the theme: the
          portal is light, and no script touches <html> before paint. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {IS_STAGING && <StagingBanner />}
        {/* Keeps a View Stage preview across every navigation, the 404 page's
            included: mounted here, at the root, not only inside the portal. */}
        <ViewAsKeeper />
        {children}
      </body>
    </html>
  )
}
