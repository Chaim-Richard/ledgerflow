export interface SendInvoiceEmailParams {
  toEmail: string;
  subject: string;
  invoiceNumber?: string;
  customerName?: string;
  totalFormatted?: string;
  invoiceUrl: string;
  customBody?: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  provider: 'resend' | 'postmark' | 'sendgrid' | 'smtp';
  messageId?: string;
  responseSummary?: string;
}

/**
 * Executes real email delivery through an externally configured delivery provider (#84).
 * Throws an explicit error if the provider rejects the payload or is unreachable.
 */
export async function deliverInvoiceEmail(params: SendInvoiceEmailParams): Promise<EmailDeliveryResult> {
  const fromEmail = process.env.EMAIL_FROM || 'invoices@ledgerflow.app';
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
      <h2 style="color: #0f172a; margin-top: 0;">Invoice ${params.invoiceNumber || ''}</h2>
      ${params.customerName ? `<p>Dear <strong>${params.customerName}</strong>,</p>` : ''}
      ${params.customBody ? `<p>${params.customBody}</p>` : `<p>Your invoice has been generated and is ready for payment.</p>`}
      ${params.totalFormatted ? `<p style="font-size: 18px; margin: 20px 0;"><strong>Amount Due: ${params.totalFormatted}</strong></p>` : ''}
      <div style="margin: 32px 0;">
        <a href="${params.invoiceUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          View &amp; Pay Invoice
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b; word-break: break-all;">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="${params.invoiceUrl}" style="color: #2563eb;">${params.invoiceUrl}</a>
      </p>
    </div>
  `;

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject: params.subject,
        html: htmlContent
      })
    });

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Resend delivery rejected (${res.status}): ${body.message || body.name || res.statusText}`);
    }
    return {
      delivered: true,
      provider: 'resend',
      messageId: body.id,
      responseSummary: `Dispatched via Resend [ID: ${body.id}]`
    };
  }

  // 2. Postmark API
  if (process.env.POSTMARK_SERVER_TOKEN) {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        From: fromEmail,
        To: params.toEmail,
        Subject: params.subject,
        HtmlBody: htmlContent
      })
    });

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Postmark delivery rejected (${res.status}): ${body.Message || res.statusText}`);
    }
    return {
      delivered: true,
      provider: 'postmark',
      messageId: body.MessageID,
      responseSummary: `Dispatched via Postmark [ID: ${body.MessageID}]`
    };
  }

  // 3. SendGrid API
  if (process.env.SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.toEmail }] }],
        from: { email: fromEmail },
        subject: params.subject,
        content: [{ type: 'text/html', value: htmlContent }]
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`SendGrid delivery rejected (${res.status}): ${errText}`);
    }
    return {
      delivered: true,
      provider: 'sendgrid',
      responseSummary: `Dispatched via SendGrid`
    };
  }

  throw new Error('NO_EMAIL_SERVICE_CONFIGURED');
}
