// People, Teams, and Access were merged into the unified Directory.
import { redirect } from 'next/navigation'

export default function TeamsRedirect() {
  redirect('/directory')
}
