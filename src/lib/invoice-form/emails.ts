/**
 * The invoice form's emails (owner, 1 November 2026, decisions A, E and F).
 * People who send through the form never sign in, so they hear everything by
 * email: the code, the copy of what they sent, its number when a new sender
 * is added, approved, returned (with the reason, and the link to send it
 * again) and paid.
 *
 * Same look as the portal's other emails (lib/email/clock-stopped.ts): the
 * gold rule, the logo, a white card, an optional navy button, tables and
 * inline styles, light only. Pure.
 */

export type FormMail =
  | { kind: 'code'; code: string }
  | { kind: 'received'; number: string | null; month: string; total: string; lines: { text: string; amount: string }[] }
  | { kind: 'numbered'; number: string; month: string; total: string }
  | { kind: 'approved'; number: string; month: string; total: string }
  | { kind: 'returned'; number: string; month: string; reason: string; link: string }
  | { kind: 'paid'; number: string; month: string; total: string; paidOn: string; ref: string | null }

const e = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

interface Parts { subject: string; pre: string; title: string; body: string[]; rows?: { text: string; amount: string }[]; total?: string; button?: { label: string; url: string }; fine: string; big?: string }

function partsOf(m: FormMail): Parts {
  switch (m.kind) {
    case 'code':
      return {
        subject: `Your True North code: ${m.code}`, pre: 'It works for 10 minutes.', title: 'Your code',
        big: m.code, body: ['Type this code on the invoice page to confirm it is you. It works for 10 minutes.'],
        fine: 'You did not ask for it? Nothing happens until the code is typed, so you can ignore this email.',
      }
    case 'received':
      return {
        subject: m.number ? `We have received your invoice ${m.number}` : 'We have received your invoice',
        pre: "If we have questions, we'll be in touch.", title: 'We have received your invoice',
        body: [
          m.number ? `Your invoice ${m.number} for ${m.month} is with True North.` : `Your invoice for ${m.month} is with True North. Its number comes by email once we add you to our records.`,
          "If we have questions, we'll be in touch. You hear from us when it is approved and when it is paid.",
        ],
        rows: m.lines, total: m.total, fine: 'A copy of what you sent through the invoice form.',
      }
    case 'numbered':
      return {
        subject: `Your invoice is ${m.number}`, pre: `${m.month}, ${m.total}.`, title: `Your invoice is ${m.number}`,
        body: [`The invoice you sent for ${m.month} (${m.total}) now has its number: ${m.number}. You hear from us when it is approved and when it is paid.`],
        fine: 'Sent because you sent an invoice through the invoice form.',
      }
    case 'approved':
      return {
        subject: `Your invoice ${m.number} is approved`, pre: 'Finance pays it next.', title: 'Your invoice is approved',
        body: [`${m.number} for ${m.month} (${m.total}) is approved. Finance pays it next, and you hear from us when it is paid.`],
        fine: 'Sent because you sent an invoice through the invoice form.',
      }
    case 'returned':
      return {
        subject: `Your invoice ${m.number} was returned`, pre: 'Fix it and send it again.', title: 'Your invoice was returned',
        body: [`${m.number} for ${m.month} was returned with this reason:`, `"${m.reason}"`, `Open the invoice form, fix what is needed and send it again for ${m.month}. It keeps the same number.`],
        button: { label: 'Open the invoice form', url: m.link },
        fine: 'Sent because you sent an invoice through the invoice form.',
      }
    case 'paid':
      return {
        subject: `Your invoice ${m.number} is paid`, pre: `Paid on ${m.paidOn}.`, title: 'Your invoice is paid',
        body: [`${m.number} for ${m.month} (${m.total}) was paid on ${m.paidOn}${m.ref ? `, reference ${m.ref}` : ''}.`],
        fine: 'Sent because you sent an invoice through the invoice form.',
      }
  }
}

export function renderFormMail(m: FormMail, origin: string): { subject: string; html: string; text: string } {
  const p = partsOf(m)
  const rows = p.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid #e4e7ec;">
${p.rows.map(r => `        <tr><td style="padding:9px 0;border-bottom:1px solid #f1f3f6;font-size:14px;color:#012358;">${e(r.text)}</td><td align="right" style="padding:9px 0 9px 12px;border-bottom:1px solid #f1f3f6;font-size:14px;font-weight:600;color:#012358;white-space:nowrap;">${e(r.amount)}</td></tr>`).join('\n')}
        ${p.total ? `<tr><td style="padding:10px 0;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:15px;color:#012358;">Total due</td><td align="right" style="padding:10px 0 10px 12px;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:15px;color:#012358;white-space:nowrap;">${e(p.total)}</td></tr>` : ''}
      </table>`
    : ''
  const button = p.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr>
          <td style="border-radius:10px;background:#012358;">
            <a href="${e(p.button.url)}" style="display:inline-block;padding:14px 28px;font-family:Raleway,Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;text-decoration:none;border-radius:10px;">${e(p.button.label)}</a>
          </td>
        </tr></table>`
    : ''
  const big = p.big ? `<p style="margin:0 0 18px;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:34px;letter-spacing:.18em;color:#012358;">${e(p.big)}</p>` : ''
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(p.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&family=Raleway:wght@800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f1efe8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(p.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1efe8;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden;">
      <tr><td style="height:3px;background:#F2C40A;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:20px 32px 16px;border-bottom:1px solid #e4e7ec;">
        <img src="${e(origin)}/logos/true-north.png" width="92" alt="True North Digital Marketing" style="display:block;width:92px;height:auto;border:0;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:16px;color:#012358;">
      </td></tr>
      <tr><td style="padding:30px 32px 8px;font-family:'Open Sans',Arial,sans-serif;color:#435066;">
        <h1 style="margin:0 0 12px;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:26px;line-height:1.25;color:#012358;">${e(p.title)}</h1>
        ${big}
        ${p.body.map(b => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#435066;">${e(b)}</p>`).join('\n        ')}
        ${rows}
        ${button}
      </td></tr>
      <tr><td style="padding:16px 32px 22px;border-top:1px solid #e4e7ec;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#8593a4;">
        ${e(p.fine)}<br>True North Digital Marketing
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
  const text = [
    p.title, '', ...(p.big ? [p.big, ''] : []), ...p.body, '',
    ...(p.rows ?? []).map(r => `${r.text}: ${r.amount}`), ...(p.total ? [`Total due: ${p.total}`, ''] : []),
    ...(p.button ? [`${p.button.label}: ${p.button.url}`, ''] : []), p.fine,
  ].join('\n')
  return { subject: p.subject, html, text }
}
