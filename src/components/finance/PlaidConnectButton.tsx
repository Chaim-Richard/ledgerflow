import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { toast } from 'sonner';
import { Link2 } from 'lucide-react';
import { getIdToken } from '../../firebase';

export default function PlaidConnectButton({ onSuccessSync }: { onSuccessSync?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const generateToken = useCallback(async () => {
    try {
      const idToken = await getIdToken();
      const response = await fetch('/api/v1/plaid/create_link_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error generating link token:', err);
    }
  }, []);

  useEffect(() => {
    generateToken();
  }, [generateToken]);

  const onSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      try {
        const idToken = await getIdToken();
        const response = await fetch('/api/v1/plaid/exchange_public_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ public_token }),
        });
        const data = await response.json();
        
        if (data.success) {
          toast.success('Bank connected successfully via Plaid');
          if (onSuccessSync) onSuccessSync();
        }
      } catch (err) {
        toast.error('Failed to connect bank');
      }
    },
    [onSuccessSync]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken!,
    onSuccess,
  });

  return (
    <button 
      onClick={() => open()}
      disabled={!ready}
      className="h-12 px-6 bg-slate-100 hover:bg-slate-200 border border-[var(--line)] text-[var(--text)] font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
    >
      <Link2 size={14} />
      <span>Connect Bank</span>
    </button>
  );
}
