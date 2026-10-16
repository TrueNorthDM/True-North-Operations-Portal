/**
 * What Who's working asks the server (app/(app)/clocky-hours/whos-working/actions.ts),
 * as one object: the top bar and the page pass the real actions, a design
 * check its own.
 */

import { clockOutFor, getWhosWorking, getWhosWorkingCount } from '@/app/(app)/clocky-hours/whos-working/actions'

export interface WorkingApi {
  load: typeof getWhosWorking
  count: typeof getWhosWorkingCount
  clockOutFor: typeof clockOutFor
}

export const WORKING_API: WorkingApi = { load: getWhosWorking, count: getWhosWorkingCount, clockOutFor }
