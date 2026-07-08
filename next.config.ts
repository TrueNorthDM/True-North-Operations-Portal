import type { NextConfig } from "next";

// TypeScript errors now block the production build again. The old
// `typescript.ignoreBuildErrors` escape hatch (added when Supabase queries
// resolved to `never`) was removed during the 2026-07 audit once the
// hand-written database types were completed and every module passed `tsc`.
const nextConfig: NextConfig = {};

export default nextConfig;
