// My Work — everything assigned to the signed-in person across Monday, as a
// board or list. Available to any signed-in user (the (app) layout gates auth).
// Data is the in-repo sample until the Monday pull is wired.

import { MyWork } from '@/components/MyWork'

export const metadata = { title: 'My Work' }

export default function MyWorkPage() {
  return <MyWork />
}
