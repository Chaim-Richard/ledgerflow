const fs = require('fs');
const content = fs.readFileSync('src/components/ledger/JournalEntryModal.tsx', 'utf-8');
const startMatch = "const isForeignCurrency = transactionCurrency !== baseCurrency;";
const endMatch = "toast.success('Journal entry recorded');";
const startIndex = content.indexOf(startMatch);
const endIndex = content.indexOf(endMatch) + endMatch.length;

const replacement = `const isForeignCurrency = transactionCurrency !== baseCurrency;
      const appliedRate = isForeignCurrency ? exchangeRate : 1.0;
      
      const totalAmountCents = Math.round(totals.debit * appliedRate);
      const payload = {
        uid: user.uid,
        workspaceId,
        date,
        description,
        reference,
        totalAmountCents,
        currency: baseCurrency,
        originalCurrency: isForeignCurrency ? transactionCurrency : undefined,
        exchangeRate: isForeignCurrency ? appliedRate : undefined,
        type: 'journal',
        status: 'completed',
        lines: lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0)).map(l => {
          const baseCents = Math.round((l.debit > 0 ? l.debit : -l.credit) * appliedRate);
          return {
            accountId: l.accountId,
            accountName: l.accountName,
            amountCents: baseCents,
            class: l.class || undefined,
            location: l.location || undefined,
            project: l.project || undefined
          };
        }),
        isCleared: true
      };

      const token = await getIdToken();
      const res = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ transaction: payload })
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || \`HTTP error \${res.status}\`);
      }

      toast.success('Journal entry recorded');`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('src/components/ledger/JournalEntryModal.tsx', newContent);
