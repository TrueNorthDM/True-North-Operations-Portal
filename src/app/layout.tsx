import type { Metadata } from 'next'
import { Geist, Geist_Mono, Nunito, Open_Sans, Bebas_Neue, Raleway } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], weight: ['700', '800'] })
const openSans = Open_Sans({ variable: '--font-open-sans', subsets: ['latin'], weight: ['400', '600', '700'] })
const bebas = Bebas_Neue({ variable: '--font-bebas-neue', subsets: ['latin'], weight: ['400'] })
// Portal display face, Raleway (True North brand; headings via globals.css h1–h3).
const raleway = Raleway({ variable: '--font-raleway', subsets: ['latin'], weight: ['700', '800', '900'] })

export const metadata: Metadata = {
  title: 'True North Operations Portal',
  description: 'Operations portal for AAAF and HFA, editorial pipeline, publishing goals, and hreflang workflows',
}

/**
 * Root layout, minimal shell only.
 * The sidebar + top bar live inside (app)/layout.tsx so they don't show up
 * on /login or /auth/callback.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning on <html>: /theme-init.js adds `.dark` before
    // React hydrates, so the server-rendered class list intentionally differs.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} ${openSans.variable} ${bebas.variable} ${raleway.variable} h-full antialiased`} suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed into <body> before React
          hydrates, causing a harmless attribute mismatch. This suppresses the
          warning for <body>'s own attributes only, it does NOT mask real
          hydration bugs deeper in the tree. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Blocking on purpose: applies the saved/system theme pre-paint so
            dark-mode users never see a light flash. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
        {children}
      </body>
    </html>
  )
}
