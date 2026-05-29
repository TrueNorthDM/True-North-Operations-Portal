# tnhref

Internal hreflang tracker for AAAF and HFA WordPress sites.

Replaces two legacy Google Sheets workflows with a Next.js 16 app:
auth (magic link, domain-restricted), Supabase + RLS, per-site language
config, hreflang generation, Monday status mirror, per-page detail editor.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack)
- React 19
- Tailwind CSS v4
- Supabase (Postgres + Auth)
- Vercel (hosting)

## Local dev

```bash
npm install
cp .env.local.example .env.local   # fill Supabase URL + anon key
npm run dev
```
