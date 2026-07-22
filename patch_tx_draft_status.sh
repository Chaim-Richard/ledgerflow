sed -i "256s/status: 'pending',/status: (tx as any).isAI ? 'draft' : 'pending',/" src/hooks/useTransactionActions.ts
