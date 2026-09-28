/**
 * The invitation email (plan step p4-code, option A: the portal sends it).
 *
 * It carries no sign-in token, so it never expires: the button opens the sign-in
 * page with the person's address filled in, and the usual sign-in email follows.
 * Same look as the sign-in email Supabase sends (supabase/templates/magic-link.html):
 * the portal's gold rule, logo and navy button, readable with images blocked.
 */

export interface InviteVars {
  firstName: string
  invitedBy: string
  email: string
  /** Where the button goes: the sign-in page with the address filled in. */
  url: string
  /** The portal's origin, for the logo and the footer link. */
  origin: string
}

const e = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function renderInvite(input: InviteVars): { subject: string; html: string; text: string } {
  const v = { ...input, host: input.origin.replace(/^https?:\/\//, '') }
  const subject = `${v.invitedBy} invited you to the True North Operations Portal`
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>You're invited to the True North Operations Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&family=Raleway:wght@800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f1efe8;">
<!-- Preheader: the line inboxes show next to the subject. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(v.invitedBy)} invited you to the portal. Accept the invitation to sign in.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1efe8;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden;">
      <!-- Gold rule and top bar, as in the portal -->
      <tr><td style="height:3px;background:#F2C40A;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:22px 36px 18px;border-bottom:1px solid #e4e7ec;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:bottom;"><img src="${e(v.origin)}/logos/true-north.png" width="92" alt="True North Digital Marketing" style="display:block;width:92px;height:auto;border:0;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:16px;color:#012358;"></td>
          <td style="vertical-align:bottom;padding:0 0 3px 10px;font-family:'Open Sans',Arial,sans-serif;font-size:13px;font-weight:600;color:#8593a4;">Operations Portal</td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:34px 36px 8px;font-family:'Open Sans',Arial,sans-serif;color:#435066;">
        <p style="margin:0 0 6px;font-size:15px;">Hi ${e(v.firstName)},</p>
        <h1 style="margin:0 0 16px;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:26px;line-height:1.25;color:#012358;">You're invited to the True North Operations Portal</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${e(v.invitedBy)} invited you. The portal is one home for the tools, dashboards and tasks that keep the team moving every day.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:10px;background:#012358;">
            <a href="${e(v.url)}" style="display:inline-block;padding:14px 28px;font-family:Raleway,Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;text-decoration:none;border-radius:10px;">Accept the invitation</a>
          </td>
        </tr></table>
        <p style="margin:22px 0 0;font-size:14px;line-height:1.6;">You'll sign in with this address: <strong style="color:#012358;">${e(v.email)}</strong></p>
      </td></tr>
      <!-- What happens next -->
      <tr><td style="padding:22px 36px 30px;font-family:'Open Sans',Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f6f1;border-radius:12px;">
          <tr><td style="padding:18px 20px;font-size:13.5px;line-height:1.6;color:#435066;">
            <p style="margin:0 0 8px;font-family:Raleway,Arial,sans-serif;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#1E7D7F;">What happens next</p>
            <p style="margin:0 0 6px;">1. The button opens the portal's sign-in page with your address filled in. Press the button there, and a sign-in code arrives by email. No password to create.</p>
                        <p style="margin:0 0 6px;">2. Then the portal asks you to add a second step: a 6&#8209;digit code from an authenticator app on your phone. You have a week to do it, and it takes a minute.</p>
            <p style="margin:0;">3. After that, sign in any time with a link or a 6&#8209;digit code sent to this address.</p>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:12.5px;line-height:1.6;color:#8593a4;">This invitation does not expire. The portal lives at <a href="${e(v.origin)}" style="color:#1E7D7F;text-decoration:none;">${e(v.host)}</a>.</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:18px 36px 24px;border-top:1px solid #e4e7ec;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#8593a4;">
        You're receiving this because an admin at True North Digital Marketing invited you to the Operations Portal. If you weren't expecting it, you can ignore this email.<br>
        <a href="${e(v.origin)}" style="color:#1E7D7F;text-decoration:none;font-weight:600;">True North Operations Portal</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`
  const text = [
    `Hi ${v.firstName},`,
    '',
    `${v.invitedBy} invited you to the True North Operations Portal, one home for the tools, dashboards and tasks that keep the team moving every day.`,
    '',
    `Accept the invitation: ${v.url}`,
    '',
    `You'll sign in with this address: ${v.email}`,
    '',
    'What happens next:',
    "1. The link opens the portal's sign-in page with your address filled in. Press the button there, and a sign-in code arrives by email. No password to create.",
    '2. Then the portal asks you to add a second step: a 6-digit code from an authenticator app on your phone. You have a week to do it, and it takes a minute.',
    '3. After that, sign in any time with a link or a 6-digit code sent to this address.',
    '',
    "You're receiving this because an admin at True North Digital Marketing invited you to the Operations Portal. If you weren't expecting it, you can ignore this email.",
  ].join('\n')
  return { subject, html, text }
}
