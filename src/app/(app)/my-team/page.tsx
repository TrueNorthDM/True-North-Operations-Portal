// My Team lives in My Work (?tab=team) since 8 October 2026: the avatar menu's
// "My Team" and the rail both go there, so there is one page and not two copies.
// This address stays for old links and bookmarks.

import { redirect } from 'next/navigation'

export default function MyTeamMoved() {
  redirect('/my-work?tab=team')
}
