import Link from 'next/link'

/**
 * Global 404, rendered for unmatched URLs and any notFound() call. Lives at
 * the root so it also covers routes outside the (app) group.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-6xl font-bold text-slate-200">404</div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">That page doesn’t exist or has moved.</p>
        <Link
          href="/"
          className="mt-6 inline-block px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
