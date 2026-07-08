// Shared view-model types for the admin People UI (PeopleManager + PersonForm).
// Kept in their own module so both components can import them without a cycle.

export interface PersonView {
  id: string
  full_name: string
  title: string | null
  manager_id: string | null
  managerName: string | null
  status: 'active' | 'inactive'
  teams: string[]
  accountId: string | null
  accountEmail: string | null
  hasTsheets: boolean
}

export interface Account {
  id: string
  email: string
}
