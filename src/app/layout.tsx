import type { Metadata } from 'next'
import { Geist, Geist_Mono, Nunito, Open_Sans, Bebas_Neue } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], weight: ['700', '800'] })
const openSans = Open_Sans({ variable: '--font-open-sans', subsets: ['latin'] })
const bebas = Bebas_Neue({ variable: '--font-bebas-neue', subsets: ['latin'], weight: ['400'] })

export const metadata: Metadata = {
  title: 'True North — Href Links',
  description: 'Manage and apply hreflang tags for AAAF and HFA WordPress sites',
}

/**
 * Root layout — minimal shell only.
 * The sidebar + top bar live inside (app)/layout.tsx so they don't show up
 * on /login or /auth/callback.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} ${openSans.variable} ${bebas.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50">
        {children}
      </body>
    </html>
  )
}
