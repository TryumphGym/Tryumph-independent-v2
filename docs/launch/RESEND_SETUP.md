# Resend setup for Tryumph Gym

Requested sender, reply-to and founder account email: **mackenzie@tryumphgym.com**. Display name: **Tryumph Gym**.

On October 27, 2026, this environment attempted to retrieve `https://resend.com/setup.md`. The network proxy returned HTTP 403, including a permitted retry and a retry after network permission was granted. The guide was **not read**. No Resend account, API key, sender domain, SMTP integration or successful delivery is claimed. No key was requested in chat, no email was sent and no DNS was edited.

The existing signup/reset path is Supabase Auth. Preserve that working path; Resend belongs behind its custom SMTP configuration rather than introducing a second account/token system in the app.

When provider access is available, use the current Resend instructions/dashboard to confirm these settings before saving them in the **staging** Supabase Authentication → Email → SMTP settings:

| Setting                               | Value                                                           |
| ------------------------------------- | --------------------------------------------------------------- |
| Resend account/contact                | `mackenzie@tryumphgym.com`                                      |
| Sender email                          | `mackenzie@tryumphgym.com`                                      |
| Sender name                           | `Tryumph Gym`                                                   |
| SMTP host                             | `smtp.resend.com` (confirm against the current Resend guide)    |
| SMTP port                             | `465` with TLS (confirm supported settings in the dashboard)    |
| SMTP username                         | `resend`                                                        |
| SMTP password                         | Resend API key, stored only in the Supabase SMTP password field |
| Application reply-to, where supported | `mackenzie@tryumphgym.com`                                      |

Verify ownership of `tryumphgym.com` in Resend. Its dashboard will supply the exact sending-domain records. Preserve existing Google Workspace MX/SPF/DKIM/DMARC and do not replace the root MX records with sending-service records. DNS changes still require separate authorization. Do not guess DKIM/SPF values. Never place an API key in a `VITE_` setting or commit one to Git.

Keep the existing independent Supabase Site URL and authorized redirect URLs. Using Resend SMTP does not require changing the application's signup/login/reset callbacks. After domain verification and SMTP setup, run real signup, confirmation, reset and resend-confirmation flows in staging, inspect delivery/bounce logs, verify From/Reply-To, and record message IDs. Only then consider separately authorized production SMTP settings. A configured password is not proof of delivery.
