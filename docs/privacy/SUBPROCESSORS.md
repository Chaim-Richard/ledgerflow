# Sub-processors (BJ-08)

Outside services that process personal data for LedgerFlow, from the code
(`src/server`). Update before a new service is used; customers are told 30 days ahead
(see the DPA template).

| Service | What it does for LedgerFlow | Data it sees | Where | Active |
|---|---|---|---|---|
| Supabase | Database, sign-in, file storage | Everything stored in LedgerFlow | US East (project `ledgerflow`) | Yes |
| Vercel | Hosting the app and the server | Requests passing through (incl. the data shown) | US / global edge | Yes |
| Stripe | Card payments of invoices; LedgerFlow subscriptions | Invoice amount, customer email, card (Stripe only) | US/EU | When set up (FOR_YOU 8) |
| Plaid | Bank feeds | Bank account, statement lines | US | When a workspace connects a bank |
| Google (Gemini API) | AI features (receipt reading, suggestions, assistant) | The text or file sent to the AI feature; no workspace-wide exports | US | When `GEMINI_API_KEY` is set |
| Resend / Postmark / SendGrid (one of them) | Sending invoices and reminders by email | Recipient email, invoice content | US/EU | When chosen (FOR_YOU 7) |
| ExchangeRate-API | Exchange rates | No personal data (currency codes only) | — | Yes |
