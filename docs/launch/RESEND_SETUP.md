# Resend setup for Tryumph Gym

Requested Resend account/contact, default sender and support inbox: **mackenzie@tryumphgym.com**. The Contact Us form sends from **Tryumph Gym Support <mackenzie@tryumphgym.com>** to that inbox. Its Reply-To remains the visitor's submitted address so you can reply to them. Authentication mail may use **Tryumph Gym <mackenzie@tryumphgym.com>** through Supabase SMTP.

## Implemented in the development branch

The recently added Contact Us form is preserved and connected to the server-only Resend Emails API. `CONTACT_FROM_EMAIL` defaults to `mackenzie@tryumphgym.com`; any configured sender must be an address on `tryumphgym.com`. The fixed recipient is `mackenzie@tryumphgym.com`. `RESEND_API_KEY` is read only on the server. Refund inquiries require a server-verified Supabase session and include that account UUID; the supplied booking reference is explicitly unverified and never triggers an automatic refund.

Migration `0055_contact_delivery.sql` adds durable provider receipt/idempotency metadata and rate limits (five delivery attempts per requester per hour, global 100/hour). Requester IPs and payloads are HMAC-hashed; no raw IP, email address, message body or JWT is saved in that table. Messages go only to your fixed inbox, not arbitrary recipient addresses. Honeypot, payload validation, concurrent-request leases, timeout/error handling and stable retry keys are connected. An ambiguous request older than 23 hours requires reconciliation rather than another send with an expired provider idempotency key.

Automated tests use a mocked Resend endpoint and isolated PostgreSQL. They check fixed sender/recipient, visitor Reply-To, verified refund identity, missing credentials, quotas, concurrent/replayed sends, provider rejection, missing receipts and acknowledgement-write failure. **No real email was sent and successful delivery is not verified.**

## Provider access blocker

On October 27, 2026, this environment requested `https://resend.com/setup.md`. The network proxy returned HTTP 403, including a permitted retry and a retry after network permission was granted. The guide was **not read**. No Resend account, API key, sending-domain verification or SMTP configuration was created. No credentials were requested in chat, and no DNS was edited. These are outstanding provider setup steps, not completed work.

## Exact staging setup

1. Sign into/create Resend using `mackenzie@tryumphgym.com`; read the provider's current setup instructions when accessible. Verify `tryumphgym.com` as a sending domain using its actual supplied records. Domain/DNS edits remain separately authorized actions; preserve Google Workspace MX/SPF/DKIM/DMARC. Do not replace the root Google MX records with sending-service records or guess DKIM values.
2. After the reviewed staging SQL bundle including `0055` is applied, store a sending-scoped `RESEND_API_KEY` securely as a **server runtime secret** on the staging Worker. Set non-secret `CONTACT_FROM_EMAIL=mackenzie@tryumphgym.com`. Never put a key in a `VITE_` variable, `.env.example`, Git or chat.
3. With separately authorized staging runtime configuration, send a real staging contact request yourself. Confirm From/To/Reply-To, mailbox receipt, provider message ID and the durable `sent` receipt. Verify invalid/refund-without-login requests fail, one retry does not duplicate delivery, and throttled requests do not call the provider. A provider API receipt proves acceptance; inspect delivery/bounce logs and your mailbox to establish actual delivery.
4. Optionally use Resend for Supabase Auth mail too. Preserve the working Supabase signup/reset/session flow and its independent Site URL/redirect allowlist. Confirm these proposed SMTP settings against the current provider guide before saving them in **staging Supabase Authentication → Email → SMTP**:

| Setting             | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| Sender email / name | `mackenzie@tryumphgym.com` / `Tryumph Gym`                  |
| SMTP host           | `smtp.resend.com` (confirm current provider instructions)   |
| SMTP port           | `465` with TLS (confirm supported settings)                 |
| SMTP username       | `resend`                                                    |
| SMTP password       | Private Resend API key, in the Supabase SMTP password field |

5. Test real signup confirmation, reset and resend-confirmation delivery in staging. Inspect delivery/bounce logs and authorized callbacks. No app authentication rewrite is required. Contact form delivery and Supabase SMTP are distinct integrations; testing one does not verify the other.

Production secrets/SMTP, deployment, DNS and email activation remain separate founder actions after acceptance. See [FOUNDER_HANDOFF.md](FOUNDER_HANDOFF.md).
