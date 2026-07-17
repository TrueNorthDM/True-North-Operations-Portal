// Team management moved inline into the unified Directory (Teams tab).
import { redirect } from 'next/navigation'

export default function TeamDetailRedirect() {
  redirect('/directory')
}
