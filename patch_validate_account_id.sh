sed -i '/return line;/i\
                if (line.accountId && line.accountId !== "uncategorized" && !accountsById.has(line.accountId)) {\
                  return { ...line, accountId: "uncategorized", accountName: "Manual Review" };\
                }' src/hooks/useTransactionActions.ts
