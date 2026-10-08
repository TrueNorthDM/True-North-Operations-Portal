// My Team lives in My Work (?tab=team) since 8 October 2026: the avatar menu's
// "My Team" and the rail both go there, so there is one page and not two copies.
// This address stays for old links and bookmarks.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function MyTeamMoved() {
  redirect(await previewHref('/my-work?tab=team'))
}
