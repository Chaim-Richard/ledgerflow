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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface SupportNotificationParams {
  toEmail: string;
  subject: string;
  ticketSubject: string;
  messageBody: string;
}

/**
 * Sends a notification email to the user when a support agent replies to their ticket.
 */
export async function sendSupportNotification(params: SupportNotificationParams): Promise<EmailDeliveryResult> {
  const fromEmail = process.env.EMAIL_FROM || 'support@ledgerflow.app';
  
  const safeTicketSubject = escapeHtml(params.ticketSubject);
  const safeMessageBody = escapeHtml(params.messageBody).replace(/\n/g, '<br/>');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
      <h2 style="color: #0f172a; margin-top: 0;">Support Update: ${safeTicketSubject}</h2>
      <p>A support agent has replied to your ticket:</p>
      <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; font-style: italic;">
        ${safeMessageBody}
      </div>
      <p>Please log in to the application to view the full thread and reply.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b;">
        This is an automated notification from LedgerFlow Support.
      </p>
    </div>
  `;

  // Use the same transport logic as deliverInvoiceEmail (extracting it would be cleaner, but keeping it simple for now)
  const deliveryParams = {
    toEmail: params.toEmail,
    subject: params.subject,
    html: htmlContent,
    from: fromEmail
  };

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

/**
 * Executes real email delivery through an externally configured delivery provider (#84, N5).
 * All user-supplied inputs are HTML-escaped to prevent email template injection.
 */
export async function deliverInvoiceEmail(params: SendInvoiceEmailParams): Promise<EmailDeliveryResult> {
  const fromEmail = process.env.EMAIL_FROM || 'invoices@ledgerflow.app';
  
  const safeInvoiceNumber = params.invoiceNumber ? escapeHtml(params.invoiceNumber) : '';
  const safeCustomerName = params.customerName ? escapeHtml(params.customerName) : '';
  const safeCustomBody = params.customBody ? escapeHtml(params.customBody) : '';
  const safeTotalFormatted = params.totalFormatted ? escapeHtml(params.totalFormatted) : '';
  const safeInvoiceUrl = encodeURI(params.invoiceUrl);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
      <h2 style="color: #0f172a; margin-top: 0;">Invoice ${safeInvoiceNumber}</h2>
      ${safeCustomerName ? `<p>Dear <strong>${safeCustomerName}</strong>,</p>` : ''}
      ${safeCustomBody ? `<p>${safeCustomBody}</p>` : `<p>Your invoice has been generated and is ready for payment.</p>`}
      ${safeTotalFormatted ? `<p style="font-size: 18px; margin: 20px 0;"><strong>Amount Due: ${safeTotalFormatted}</strong></p>` : ''}
      <div style="margin: 32px 0;">
        <a href="${safeInvoiceUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          View &amp; Pay Invoice
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b; word-break: break-all;">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="${safeInvoiceUrl}" style="color: #2563eb;">${safeInvoiceUrl}</a>
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
