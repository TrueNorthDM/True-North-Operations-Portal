/**
 * Clocky's one email (design handoff of 16 October 2026, Clock Safety.dc.html
 * frame N2): "Your clock stopped by itself". Sent when the safety net stopped a
 * forgotten clock at 5h 00m; the 4h 30m "Still working?" is the bell only.
 *
 * Same look as the portal's other emails (invite.ts, public/email-templates/
 * magic-link.html): the gold rule, the logo, a white card and one navy button,
 * tables and inline styles so every mail client draws it, readable with images
 * blocked, light only. Pure.
 */

export interface ClockStoppedVars {
  /** "1:00 PM", or "1:00 PM on Mon, Oct 12" (the person's zone). */
  stoppedAt: string
  /** The clock in (or the last "Keep going"), on the quarter hour: "8:00 AM". */
  clockedInAt: string
  /** Where the button goes: the portal with the clock panel open. */
  url: string
  /** The portal's origin, for the logo and the footer link. */
  origin: string
}

const e = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function renderClockStopped(v: ClockStoppedVars): { subject: string; html: string; text: string } {
  const subject = `Your clock stopped by itself at ${v.stoppedAt}`
  const pre = 'Confirm when you really stopped.'
  const title = 'Your clock stopped by itself'
  const body = `Your clock stopped by itself at ${v.stoppedAt}. Confirm when you really stopped.`
  const button = 'Confirm end time'
  const fine = `It ran 5h 00m without an answer since you clocked in at ${v.clockedInAt}. Until you confirm, the entry shows "Auto out" and the clock button in the portal stays red.`
  const footer = 'Sent to you because North Time stopped your clock.'

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&family=Raleway:wght@800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f1efe8;">
<!-- Preheader: the line inboxes show next to the subject. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1efe8;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden;">
      <!-- Gold rule and top bar, as in the portal -->
      <tr><td style="height:3px;background:#F2C40A;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:20px 32px 16px;border-bottom:1px solid #e4e7ec;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:bottom;"><img src="${e(v.origin)}/logos/true-north.png" width="92" alt="True North Digital Marketing" style="display:block;width:92px;height:auto;border:0;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:16px;color:#012358;"></td>
          <td style="vertical-align:bottom;padding:0 0 3px 10px;font-family:'Open Sans',Arial,sans-serif;font-size:13px;font-weight:600;color:#8593a4;">Operations Portal</td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:30px 32px 8px;font-family:'Open Sans',Arial,sans-serif;color:#435066;">
        <h1 style="margin:0 0 12px;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:26px;line-height:1.25;color:#012358;">${e(title)}</h1>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#435066;">${e(body)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:10px;background:#012358;">
            <a href="${e(v.url)}" style="display:inline-block;padding:14px 28px;font-family:Raleway,Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;text-decoration:none;border-radius:10px;">${e(button)}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;font-family:'Open Sans',Arial,sans-serif;">
        <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8593a4;">${e(fine)}</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:16px 32px 22px;border-top:1px solid #e4e7ec;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#8593a4;">
        ${e(footer)}<br>
        <a href="${e(v.origin)}" style="color:#1E7D7F;text-decoration:none;font-weight:600;">True North Operations Portal</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`
  const text = [title, '', body, '', `${button}: ${v.url}`, '', fine, '', footer].join('\n')
  return { subject, html, text }
}
