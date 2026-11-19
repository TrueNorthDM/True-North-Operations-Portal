import { describe, expect, it } from 'vitest'
import { choiceForTyped, endChoices, parseTyped, roundQuarter, stepChoice } from './end-time'
import { endOptions } from './safety'

const ZONE = 'America/New_York'
// Clocked in at 8:45 AM on Wed, Nov 18 (ET), stopped by itself at 8:45 PM; opened the next morning at 9:10 AM.
const start = '2026-11-18T13:45:00.000Z', stop = '2026-11-19T01:45:00.000Z', now = new Date('2026-11-19T14:10:00.000Z')
const choices = endChoices(endOptions(start, stop, now, false), endOptions(start, stop, now, true), stop, ZONE)
const at = (min: number) => choices.find(c => c.minutes === min)!

describe('endChoices', () => {
  it('runs earliest first, on the day it stopped only, with no time twice', () => {
    expect(choices[0].minutes).toBe(9 * 60)
    expect(choices[choices.length - 1].minutes).toBe(23 * 60 + 45)
    expect(choices.map(c => c.minutes)).toEqual([...new Set(choices.map(c => c.minutes))].sort((a, b) => a - b))
    expect(choices.some(c => c.iso === stop)).toBe(true)
  })
})

describe('typed times', () => {
  it('rounds to the quarter hour: 5:07 down, 5:08 up', () => {
    expect(roundQuarter(17 * 60 + 7)).toBe(17 * 60)
    expect(roundQuarter(17 * 60 + 8)).toBe(17 * 60 + 15)
    expect(choiceForTyped('5:07 pm', choices, stop)).toEqual(at(17 * 60))
    expect(choiceForTyped('5:08 PM', choices, stop)).toEqual(at(17 * 60 + 15))
  })
  it('reads the ways people type a time', () => {
    expect(parseTyped('5pm')).toEqual({ minutes: 17 * 60, meridiem: 'pm' })
    expect(parseTyped('5:30 p')).toEqual({ minutes: 17 * 60 + 30, meridiem: 'pm' })
    expect(parseTyped('517pm')).toEqual({ minutes: 17 * 60 + 17, meridiem: 'pm' })
    expect(parseTyped('17:07')).toEqual({ minutes: 17 * 60 + 7, meridiem: 'pm' })
    expect(parseTyped('5.30')).toEqual({ minutes: 5 * 60 + 30, meridiem: null })
    expect(parseTyped('12am')).toEqual({ minutes: 0, meridiem: 'am' })
    expect(parseTyped('half past five')).toBeNull()
    expect(parseTyped('25:00')).toBeNull()
    expect(parseTyped('5:75')).toBeNull()
  })
  it('with no AM or PM, takes the half of the day that is a choice', () => {
    // 5:30 can only be PM here: the clock started at 8:45 AM.
    expect(choiceForTyped('5:30', choices, stop)).toEqual(at(17 * 60 + 30))
    // 9:30 is a choice in the morning and at night: the one nearer the time already chosen.
    expect(choiceForTyped('9:30', choices, stop)).toEqual(at(21 * 60 + 30))
    expect(choiceForTyped('9:30', choices, at(10 * 60).iso)).toEqual(at(9 * 60 + 30))
  })
  it('refuses a time that is not a choice', () => {
    expect(choiceForTyped('7:00 am', choices, stop)).toBeNull()
    expect(choiceForTyped('soon', choices, stop)).toBeNull()
  })
})

describe('stepChoice', () => {
  it('moves a quarter hour and stops at the ends', () => {
    expect(stepChoice(choices, stop, -1)).toEqual(at(20 * 60 + 30))
    expect(stepChoice(choices, stop, 1)).toEqual(at(21 * 60))
    expect(stepChoice(choices, choices[0].iso, -1)).toEqual(choices[0])
  })
})
