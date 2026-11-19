'use client'

/**
 * A 6-digit code shown as six boxes, one per digit (owner, 19 November 2026:
 * option C of the two-step screen). It is ONE real input laid over the boxes,
 * so pasting a whole code, the phone's one-time-code autofill, Backspace and
 * screen readers all work as on a plain field; the boxes only draw what it
 * holds. Digits only: spaces and anything else are dropped as they arrive.
 */

import { useState, type Ref } from 'react'

export interface CodeBoxesProps {
  value: string
  onChange: (digits: string) => void
  /** What a screen reader says for the field. */
  label: string
  autoFocus?: boolean
  /** While a code is being checked: it cannot change, but it keeps the focus (disabled would drop it). */
  readOnly?: boolean
  /** To put the cursor back in it, after a wrong code. */
  inputRef?: Ref<HTMLInputElement>
}

export const CODE_LENGTH = 6

export function CodeBoxes({ value, onChange, label, autoFocus, readOnly, inputRef }: CodeBoxesProps) {
  const [focused, setFocused] = useState(false)
  const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
  // The box the next digit goes in; the last one stays lit once all six are in.
  const at = Math.min(digits.length, CODE_LENGTH - 1)

  return (
    <div className="relative mx-auto flex w-full max-w-[330px] justify-center gap-2">
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const lit = focused && i === at
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`flex h-14 max-w-[46px] flex-1 items-center justify-center rounded-xl border-[1.5px] bg-card font-mono text-[22px] text-tn-ink transition-colors ${i === 3 ? 'ml-1.5' : ''} ${lit ? 'border-tn-teal ring-[3px] ring-tn-teal/20' : 'border-slate-300'}`}
          >
            {digits[i] ?? (lit && digits.length < CODE_LENGTH ? <span className="h-6 w-[2px] animate-pulse bg-tn-teal" /> : null)}
          </span>
        )
      })}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={digits}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        readOnly={readOnly}
        ref={inputRef}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  )
}
