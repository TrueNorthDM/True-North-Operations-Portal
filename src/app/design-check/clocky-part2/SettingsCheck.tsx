'use client'

// 13A, 13B, 13C (Company Settings.dc.html): the real Company settings
// sections with the prototype's values, in the page's own sub-navigation.
// Nothing saves.

import { SettingsNav } from '@/components/SettingsNav'
import { IntegrationsSettings, InvoiceSettings, RemindersSettings } from '@/components/settings/ClockySettings'
import type { IntegrationsData, InvoiceSettingsData } from '@/lib/timeclock/company-settings'

const ok = async () => ({ ok: true as const, toast: 'Saved.' })
const icon = (d: string) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>

export function SettingsCheck({ frame, integrations, invoices }: { frame: string; integrations: IntegrationsData; invoices: InvoiceSettingsData }) {
  const head = (title: string, desc: string) => (
    <div className="mb-[18px]">
      <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">{title}</h2>
      <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed">{desc}</p>
    </div>
  )
  return (
    <div className="space-y-[22px]">
      <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Company settings</h1>
      <SettingsNav signedIn={{ name: 'Arnaldo Oliveira', role: 'Super Admin · True North' }} startSection={frame === '13B' ? 'invoices' : frame === '13C' ? 'reminders' : 'integrations'} sections={[
        { id: 'invoices', label: 'Invoices', icon: icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5'), isNew: true, editable: false,
          content: <div>{head('Invoices', 'How invoices and reimbursement documents are numbered, and what True North puts in the "To" block.')}<InvoiceSettings data={invoices} canEdit save={ok} /></div> },
        { id: 'integrations', label: 'Integrations', icon: icon('M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'), isNew: true, editable: false,
          content: <div>{head('Integrations', 'Rippling for payroll and PTO, Google Calendar for the team calendar. The portal fills them; nobody copies by hand.')}
            <IntegrationsSettings data={integrations} canEdit api={{ saveRipplingToken: ok, removeRipplingToken: ok, saveGoogle: ok, removeGoogle: ok, testGoogle: async () => ({ ok: true, toast: 'Google Calendar answered: the team calendar can be read; the Good News Calendar can be read.' }), retryIntegrationJob: async () => ({ ok: true, toast: 'Queued again.' }), saveGoogleApp: ok, removeGoogleApp: ok }} /></div> },
        { id: 'reminders', label: 'Reminders', icon: icon('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0'), isNew: true, editable: false,
          content: <div>{head('Reminders', 'When the bell reminds people to submit, and the new lines it shows.')}<RemindersSettings on={{ contractor_due: true, pay_period_ends: true, late: true, allowance: true, birthday: true }} canEdit set={ok} /></div> },
      ]} />
    </div>
  )
}
