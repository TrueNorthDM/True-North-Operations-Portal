// Shared sort/filter model for the Directory tables (People, Emails, Rates &
// Costs). Each tab keeps its own row markup and grouping; these types let them
// share one "sort any column + filter by anything" engine.

export type ColType = 'text' | 'number' | 'date' | 'enum'

export interface GridColumn<T> {
  id: string
  label: string
  type: ColType
  // The scalar used for BOTH sorting and filtering (null / '' = empty).
  get: (row: T) => string | number | null
  // enum columns: the selectable values, with display labels for the picker/chip.
  options?: { value: string; label: string }[]
}

export type SortDir = 'asc' | 'desc'
export interface SortState { id: string; dir: SortDir }

// Operators offered per column type (see operatorsFor in ./utils).
export type Operator =
  | 'contains' | 'is' | 'is_not' | 'empty' | 'not_empty'
  | 'gt' | 'lt' | 'before' | 'after'

export interface FilterCond {
  key: string   // stable id for React keys + removal
  col: string   // GridColumn.id
  op: Operator
  value: string // '' for the value-less operators (empty / not_empty)
}
