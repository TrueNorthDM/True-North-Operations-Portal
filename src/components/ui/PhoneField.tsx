'use client'

/**
 * A phone number in international form (owner, 10 November 2026): the country,
 * with its flag and calling code, picked from a list, then the number, shaped
 * as it is typed ("+55 85 98683 9825"). The value is what the portal stores:
 * the calling code and the number, digits only ("5585986839825").
 */

import { useMemo, useState } from 'react'
import { AsYouType, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { Select } from '@/components/ui/Select'
import { allCountries } from '@/lib/countries'

const codeOf = (country: string) => { try { return getCountryCallingCode(country as CountryCode) } catch { return '' } }

/** The country and the national digits of a stored number; `fallback` when it has none. */
export function splitPhone(value: string, fallback: string): { country: string; national: string } {
  const digits = value.replace(/\D/g, '')
  if (!digits) return { country: fallback, national: '' }
  const pn = parsePhoneNumberFromString(`+${digits}`)
  if (pn?.country) return { country: pn.country, national: String(pn.nationalNumber) }
  return { country: fallback, national: digits }
}

export function PhoneField({ id, value, onChange, defaultCountry = 'US', className = '', selectClassName = '' }: {
  id?: string
  /** Digits with the calling code ("5585986839825"), or empty. */
  value: string
  onChange: (digits: string) => void
  /** The country offered first when the number is empty (the address's country). */
  defaultCountry?: string
  /** The number input's look. */
  className?: string
  /** The country button's look. */
  selectClassName?: string
}) {
  const start = useMemo(() => splitPhone(value, defaultCountry || 'US'), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState(start.country)
  const [national, setNational] = useState(start.national)
  const options = useMemo(() => allCountries().map(c => ({ value: c.code, label: `${c.flag ? `${c.flag}  ` : ''}${c.name} +${codeOf(c.code)}` })), [])

  const emit = (c: string, n: string) => {
    const digits = n.replace(/\D/g, '')
    onChange(digits ? `${codeOf(c)}${digits.replace(/^0+/, '')}` : '')
  }
  const shown = national ? new AsYouType(country as CountryCode).input(national) : ''
  const full = national ? parsePhoneNumberFromString(`+${codeOf(country)}${national.replace(/\D/g, '').replace(/^0+/, '')}`) : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-2 max-sm:grid-cols-1">
        <Select value={country} options={options} searchable fullWidth ariaLabel="Phone country" className={selectClassName}
          onChange={c => { setCountry(c); emit(c, national) }} />
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted tabular-nums pointer-events-none">+{codeOf(country)}</span>
          <input id={id} inputMode="tel" autoComplete="tel-national" value={shown} placeholder="Number"
            onChange={e => { const n = e.target.value.replace(/[^\d]/g, ''); setNational(n); emit(country, n) }}
            className={`${className} tabular-nums`} style={{ paddingLeft: `${1.4 + (codeOf(country).length + 1) * 0.6}rem` }} />
        </div>
      </div>
      <span className="text-[11px] text-muted tabular-nums">
        {full ? `${full.formatInternational()}${full.isValid() ? '' : ' (check the number)'}` : 'Pick the country, then type the number.'}
      </span>
    </div>
  )
}
