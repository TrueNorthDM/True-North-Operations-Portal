# True North Operations Portal

Unified operations portal for the **AAAF** and **HFA** sites. Brings together,
in one Next.js app:

- **Boards Review** — editorial translation pipeline + weekly publishing goals
  (Monday.com integration; absorbed from the former COE Dashboard).
- **Href Links** — hreflang tag tracker for the WordPress sites (replaces two
  legacy Google Sheets workflows).

Auth (magic link, domain-restricted with a named admin exception), Supabase +
RLS, per-site language config, hreflang generation, Monday status mirror,
per-page detail editor.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack)
- React 19
- Tailwind CSS v4
- Supabase (Postgres + Auth)
- Vercel (hosting)

## Local dev

```bash
npm install
cp .env.local.example .env.local   # fill Supabase URL + anon key (+ Monday token)
npm run dev                        # http://localhost:3000
```

## Access

- Anyone with a **@goodnewsadvocates.org** email can sign in.
- **arnaldo.oliveira@me.com** is allowed as a named exception and is auto-promoted to **admin**.
- Roles: `admin` (can edit publishing targets) / `viewer` (read-only).
