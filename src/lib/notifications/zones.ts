/**
 * The time zones a person can pick for their summary (7 October 2026): the
 * ones the team is likely to be in first, then every zone the runtime knows,
 * by region, for anyone else. No choice means the company's, New York.
 */

import { DAILY_ZONE } from './catalogue'

export const COMMON_ZONES: readonly { zone: string; label: string }[] = [
  { zone: 'America/New_York', label: 'New York (US Eastern)' },
  { zone: 'America/Chicago', label: 'Chicago (US Central)' },
  { zone: 'America/Denver', label: 'Denver (US Mountain)' },
  { zone: 'America/Phoenix', label: 'Phoenix (Arizona)' },
  { zone: 'America/Los_Angeles', label: 'Los Angeles (US Pacific)' },
  { zone: 'America/Sao_Paulo', label: 'São Paulo (Brasília)' },
  { zone: 'America/Mexico_City', label: 'Mexico City' },
  { zone: 'America/Bogota', label: 'Bogotá' },
  { zone: 'Europe/London', label: 'London' },
  { zone: 'Europe/Lisbon', label: 'Lisbon' },
  { zone: 'Europe/Paris', label: 'Paris (Central Europe)' },
  { zone: 'Africa/Lagos', label: 'Lagos (West Africa)' },
  { zone: 'Africa/Johannesburg', label: 'Johannesburg' },
  { zone: 'Africa/Nairobi', label: 'Nairobi (East Africa)' },
  { zone: 'Asia/Kolkata', label: 'India' },
  { zone: 'Asia/Manila', label: 'Manila' },
  { zone: 'Australia/Sydney', label: 'Sydney' },
]

const COMMON = new Map(COMMON_ZONES.map(z => [z.zone, z.label]))

/** "Sao_Paulo" -> "Sao Paulo", for zones not in the common list. */
const cityOf = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

/** How a zone is said on the page and in the email footer. */
export function zoneLabel(zone: string | null | undefined): string {
  const z = zone || DAILY_ZONE
  return COMMON.get(z) ?? cityOf(z)
}

/** Every zone, the common ones first, the rest under their region. */
export function zoneOptions(): { value: string; label: string; group: string }[] {
  const all = ((Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [])
    .filter(z => z.includes('/') && !COMMON.has(z))
  return [
    ...COMMON_ZONES.map(z => ({ value: z.zone, label: z.label, group: 'Common' })),
    ...all.map(z => ({ value: z, label: cityOf(z), group: z.split('/')[0] })),
  ]
}
