sed -i 's/await handleQuickAdd({/await handleQuickAdd({ isAI: true, /g' src/hooks/useTransactionActions.ts
