import React, { useState } from 'react';
import { Mail, ShieldCheck, CheckCircle2, AlertCircle, Copy, Check, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailDeliverabilitySettings() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const dnsRecords = [
    {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:resend.com ~all',
      status: 'verified',
      description: 'SPF record grants permission to send emails on behalf of your domain.'
    },
    {
      type: 'CNAME',
      name: 'resend._domainkey',
      value: 'dkim.resend.com',
      status: 'verified',
      description: 'DKIM cryptographically signs outgoing emails to prevent spoofing.'
    },
    {
      type: 'TXT',
      name: '_dmarc',
      value: 'v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com',
      status: 'verified',
      description: 'DMARC defines how receiving servers handle unauthenticated emails.'
    }
  ];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Email Deliverability &amp; Domain Setup</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure SPF, DKIM, and DMARC DNS records to ensure invoices and notifications bypass spam filters.
            </p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Required DNS Authentication Records
          </h4>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {dnsRecords.map((rec, idx) => (
              <div key={idx} className="p-4 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                      {rec.type}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{rec.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded font-mono text-xs text-slate-700 dark:text-slate-300">
                  <span className="truncate mr-2">{rec.value}</span>
                  <button
                    onClick={() => handleCopy(rec.value, `${rec.type} record`)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shrink-0"
                    title="Copy record value"
                  >
                    {copiedField === `${rec.type} record` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Bounce &amp; Complaint Auto-Suppression
          </h4>
          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              LedgerFlow automatically listens to provider webhooks (`/api/v1/webhooks/email/*`). Any customer email address that hard-bounces or logs a spam complaint is automatically suppressed to protect your domain reputation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
