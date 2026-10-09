/** The error Postgres gives for a table that does not exist yet (a migration not run). */
export const missingTable = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''))
