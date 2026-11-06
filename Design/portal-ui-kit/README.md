# Portal UI kit (for mockups)

Mockups of new portal screens are drawn with this kit, so they show the portal's real look:
same fonts, colors, buttons, fields, tabs, pills, tables, modal, shell and icons.

- `portal-kit.css`: every rule is copied from the portal's source. The header of the file maps
  each class to its source (`src/app/globals.css`, `src/lib/ui/*.ts`, `src/components/ui/*`,
  `src/components/Sidebar.tsx`, `src/app/(app)/layout.tsx`). Light theme only.
- `nav-icons.js`: generated from `src/lib/nav/nav-icons.ts`. Regenerate after an icon changes:
  `python3 -I "Design/portal-ui-kit/sync-icons.py"` from the repo root.
- `true-north.png`: copy of `public/logos/true-north.png`.

Rules:
1. A mockup uses only kit classes. If it needs an element the kit does not have, draw it in the
   mockup marked "proposed" (gold dashed outline when notes are on).
2. Once approved, the new element becomes a shared constant in `src/lib/ui` (or a component in
   `src/components/ui`) and then a class here, in that order.
3. When a shared constant in `src/lib/ui` changes, update the matching rule here in the same commit.

A mockup folder links the kit as `kit/` (a symlink locally; on publish each kit file is sent
under `kit/`). Example: `Design/Topic Studio mockup/`.
