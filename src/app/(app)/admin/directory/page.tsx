import { redirect } from 'next/navigation'

// Directory moved out from under Admin to a top-level /directory page. Keep this
// redirect so any old /admin/directory links still land in the right place.
export default function LegacyDirectoryRedirect() {
  redirect('/directory')
}
