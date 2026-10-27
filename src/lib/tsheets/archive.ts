// Archiving a TSheets (QuickBooks Time) user on their North Time start date
// (owner, 27 October 2026). The one write the portal makes to TSheets: a user
// is archived by setting active to false (PUT /users). Their timesheets stay
// in TSheets and stay readable by the import.
//
// Pure fetch wrapper like client.ts: the token comes from the caller. Called
// only by /api/cron/north-time-archive, and only when TSHEETS_ARCHIVE_USERS is
// "on" (lib/timeclock/waves.ts, archiveEnabled).

const BASE = 'https://rest.tsheets.com/api/v1'
const CALL_TIMEOUT_MS = 30_000

/** Archive one TSheets user. Throws with TSheets' words when it refuses. */
export async function archiveTsheetsUser(token: string, userId: number): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error(`Not a TSheets user id: ${userId}`)
  let json: { results?: { users?: Record<string, { _status_code?: number; _status_message?: string; _status_extra?: string }> }; error?: { code?: number; message?: string } }
  try {
    const res = await fetch(`${BASE}/users`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [{ id: userId, active: false }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`TSheets API /users: HTTP ${res.status}`)
    json = await res.json()
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new Error(`TSheets API /users: QuickBooks Time did not answer within ${CALL_TIMEOUT_MS / 1000} seconds`)
    throw e
  }
  if (json.error) throw new Error(`TSheets API /users: ${json.error.message} (code ${json.error.code})`)
  // Each user in a PUT answers with its own status: 200 is done.
  const one = Object.values(json.results?.users ?? {})[0]
  if (one?._status_code && one._status_code !== 200) {
    throw new Error(`TSheets API /users: ${one._status_message ?? 'refused'}${one._status_extra ? ` (${one._status_extra})` : ''}`)
  }
}
