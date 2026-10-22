# Runbook: emails do not arrive (invoices, reminders, invites, password resets)

**What people see:** "Email sent" in the app but nothing arrives, reminders never go out, an invite
link never reaches the person, a password reset email is missing.

## 1. Is sending set up at all?

Open **`/status`** and read **Email (invoices, reminders)**:

- **"Sending email is not set up on this installation."** — there is no email provider key. Nothing
  will ever arrive. Hand to the owner: one of `RESEND_API_KEY`, `SENDGRID_API_KEY` or
  `POSTMARK_SERVER_TOKEN`, plus `EMAIL_FROM`.
- **"Set up."** — the server has a provider. Go to step 2.

## 2. Did the server actually send it?

Ask for the recipient address and the time, then check, in this order:

1. **Spam / promotions folder and the domain's quarantine** — the most common answer by far.
2. **Is `EMAIL_FROM` a domain the provider has verified?** A provider refuses to send from an
   unverified domain (or sends it and the receiving side drops it). The owner sees the refusal in
   the provider's dashboard — the app only knows "sent".
3. **The provider dashboard's log** (Resend/SendGrid/Postmark): a `bounce` or `dropped` entry names
   the reason. This is the single most useful thing to collect.
4. **Did the daily job run?** Reminders and recurring invoices are sent by the daily job, not when a
   screen is open. `/status` → **Scheduled jobs** says when it last ran and names a job that failed
   (for example `reminders`).

## 3. A specific document

- **Invoice "sent" but the customer says nothing arrived** — attach the invoice as PDF and send it
  from the owner's own mailbox as a stop-gap; do not re-send the same document repeatedly, each send
  is recorded on the document.
- **Invite not received** — the owner sends a new invite from **Settings → Team**; an old link is
  single-use and expires.

## 4. Webhooks ("provider says delivered, app never marks it sent")

If the provider shows the message delivered but the app still shows "not sent", the provider's
webhook to the app is failing. The owner checks the webhook URL and `EMAIL_WEBHOOK_SECRET` in the
provider dashboard. Do not rotate the secret yourself: a wrong secret silently drops every event.

## 5. Never do this

- Do not send a customer an invoice, statement or reminder from a personal mailbox without the
  owner's agreement — a statement with the wrong figures is worse than a late one.
- Do not put an API key in a support ticket, chat message or screenshot.
