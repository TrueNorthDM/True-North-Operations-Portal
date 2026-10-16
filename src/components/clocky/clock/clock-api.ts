/**
 * What the clock panel asks the server (app/(app)/clocky-hours/clock-actions.ts),
 * as one object the panel is handed: the top bar passes the real actions; a
 * design check passes its own, so every frame renders from props.
 */

import {
  clockIn, clockOut, confirmEnd, createCombination, deleteCombination, getClockPanel, keepGoing, reorderCombinations,
  saveRunningDetails, switchTo, undoClockOut, updateCombination,
} from '@/app/(app)/clocky-hours/clock-actions'

export interface ClockApi {
  load: typeof getClockPanel
  clockIn: typeof clockIn
  switchTo: typeof switchTo
  clockOut: typeof clockOut
  undoClockOut: typeof undoClockOut
  saveRunningDetails: typeof saveRunningDetails
  keepGoing: typeof keepGoing
  confirmEnd: typeof confirmEnd
  createCombination: typeof createCombination
  updateCombination: typeof updateCombination
  deleteCombination: typeof deleteCombination
  reorderCombinations: typeof reorderCombinations
}

export const CLOCK_API: ClockApi = {
  load: getClockPanel, clockIn, switchTo, clockOut, undoClockOut, saveRunningDetails, keepGoing, confirmEnd,
  createCombination, updateCombination, deleteCombination, reorderCombinations,
}
