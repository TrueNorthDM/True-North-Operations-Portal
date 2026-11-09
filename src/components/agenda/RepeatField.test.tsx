import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RepeatField } from './RepeatField'
import type { Repeat } from '@/lib/agenda/recurrence'

// A Monday, so "Every week on Monday" is one of the usual choices.
const DATE = '2026-11-09'

function Harness({ start }: { start: Repeat | null }) {
  const [value, setValue] = useState<Repeat | null>(start)
  return <RepeatField date={DATE} value={value} onChange={setValue} />
}

const pick = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Repeat' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

describe('RepeatField, Custom (owner, 8 November 2026)', () => {
  it('opens the Custom panel from "Every week on Monday", so every 2 weeks can be set', () => {
    render(<Harness start={{ freq: 'weekly', interval: 1, days: [1], monthBy: 'day', ends: 'never' }} />)
    expect(screen.queryByLabelText('Every how many')).toBeNull()
    pick('Custom…')
    const every = screen.getByLabelText('Every how many')
    fireEvent.change(every, { target: { value: '2' } })
    expect((screen.getByLabelText('Every how many') as HTMLInputElement).value).toBe('2')
  })

  it('opens the Custom panel when nothing repeated before', () => {
    render(<Harness start={null} />)
    pick('Custom…')
    expect(screen.getByLabelText('Every how many')).toBeTruthy()
  })

  it('closes the Custom panel when a usual choice is picked again', () => {
    render(<Harness start={null} />)
    pick('Custom…')
    pick('Every day')
    expect(screen.queryByLabelText('Every how many')).toBeNull()
  })
})
