'use client'

// The Agenda guide's pictures: the real Agenda and Agenda settings, fed the
// manual's made-up data (lib/manual/samples/agenda.ts). Nothing saves, nothing
// navigates; the picture around them (GuideParts) makes them inert anyway.

import { AgendaView, type AgendaData } from '@/components/agenda/AgendaView'
import { AgendaSettings, type AgendaSettingsApi, type AgendaSettingsCard } from '@/components/agenda/settings/AgendaSettings'
import { agendaSample, agendaSettingsSample } from '@/lib/manual/samples/agenda'

const EXAMPLE = { ok: true as const, toast: 'This is an example.' }
const noop = async () => EXAMPLE

const SETTINGS_API: AgendaSettingsApi = {
  connectAccount: noop, disconnectAccount: noop, setInviteAccount: noop, saveWorkingHours: noop,
  connectTeamCalendar: noop, disconnectTeamCalendar: noop, setAllLevels: noop, saveBookingLink: noop,
  disconnectZoom: noop, saveMeetingLink: noop,
}

export function AgendaPicture({ view }: { view: AgendaData['view'] }) {
  return <AgendaView data={agendaSample(view)} linked={false} api={noop} edit={{ update: noop, remove: noop }} />
}

export function AgendaSettingsPicture({ only }: { only: readonly AgendaSettingsCard[] }) {
  return <AgendaSettings data={agendaSettingsSample()} api={SETTINGS_API} only={only} />
}
