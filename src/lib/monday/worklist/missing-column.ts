// "That column is not there yet", told apart from every other database error.
//
// Every migration in this module ships after the code that reads its column, so
// between a deploy and the migration being run a read has to degrade instead of
// failing. Its own module because the sync, the page and the discovery all ask
// the question, and discovery cannot import the sync: the sync imports it.

/** True when PostgREST says a column is not there, which is what a migration not yet run looks like. */
export function missingColumn(error: { message?: string } | null | undefined, column: string): boolean {
  return !!error?.message && error.message.includes(column)
    && /does not exist|could not find|schema cache/i.test(error.message)
}
