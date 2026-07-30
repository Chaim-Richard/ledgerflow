import React, { useEffect, useState } from 'react';
import { Invoice } from '../../types';
import { parseLocalDate, formatCurrency } from '../../lib/utils';
import { CheckCircle2, AlertCircle, Building2, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function PublicInvoicePage() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const token = window.location.pathname.split('/i/')[1];
    if (!token) {
      setError('Invalid invoice link');
      setLoading(false);
      return;
    }

    fetch(`/api/public/invoice/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvoice(data.invoice);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load invoice');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePay = async () => {
    if (!invoice) return;
    setIsPaying(true);
    try {
      const res = await fetch(`/api/public/invoice/${invoice.paymentToken}/pay`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to initiate payment');
        setIsPaying(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Payment error');
      setIsPaying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Invoice</h2>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoice {invoice.number}</h1>
              <p className="text-sm text-gray-500">Issued on {parseLocalDate(invoice.date || '').toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {isPaid ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2 font-medium">
                <CheckCircle2 size={18} />
                Paid
              </div>
            ) : (
              <button
                onClick={handlePay}
                disabled={isPaying}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isPaying ? 'Processing...' : `Pay ${formatCurrency(invoice.totalCents || invoice.amountCents)}`}
              </button>
            )}
          </div>
        </div>

        {/* Invoice Body */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row justify-between gap-8 mb-12">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
                <p className="text-lg font-medium text-gray-900">{invoice.customerName}</p>
              </div>
              <div className="sm:text-right">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Amount</h3>
                <p className="text-4xl font-bold text-gray-900">{formatCurrency(invoice.totalCents || invoice.amountCents)}</p>
                {!isPaid && (
                  <p className="text-sm text-gray-500 mt-1">Due by {parseLocalDate(invoice.dueDate || '').toLocaleDateString()}</p>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Description</h3>
              <p className="text-gray-800">{invoice.metadata?.memo || 'Services rendered'}</p>
            </div>

          </div>
          <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
            <p>Powered by LedgerFlow</p>
          </div>
        </div>

      </div>
    </div>
  );
}
