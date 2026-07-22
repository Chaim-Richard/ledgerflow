sed -i "s/status: 'reconciled',/status: tx.isAI ? 'draft' : 'pending',/g" src/hooks/useTransactionActions.ts
