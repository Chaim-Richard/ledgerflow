#!/bin/bash
awk '
/const handleExecuteIntent = \(\) => \{/ {
  in_func=1
  print "  // Execute Natural Language Intent"
  print "  const handleExecuteIntent = async () => {"
  print "    if (!parsedIntent || parsedIntent.type === '\''unknown'\'') return;"
  print "    if (parsedIntent.type === '\''transaction'\'') {"
  print "      const amountCents = parsedIntent.amountCents || 0;"
  print "      const isExpense = parsedIntent.action === '\''expense'\'';"
  print "      const cashAccountId = ledger.accounts.find(a => a.type === '\''asset'\'')?.id || '\''acc-cash'\'';"
  print "      const categoryAccountId = isExpense "
  print "        ? (ledger.accounts.find(a => a.type === '\''expense'\'')?.id || '\''acc-exp'\'')"
  print "        : (ledger.accounts.find(a => a.type === '\''income'\'')?.id || '\''acc-inc'\'');"
  print "      await handleQuickAdd({"
  print "        date: parsedIntent.dateStr || getLocalDateISO(),"
  print "        description: parsedIntent.description || '\''Natural Language Entry'\'',"
  print "        totalAmountCents: amountCents,"
  print "        lines: ["
  print "          {"
  print "            accountId: categoryAccountId,"
  print "            accountName: isExpense ? '\''General Expense'\'' : '\''Revenue'\'',"
  print "            amountCents: isExpense ? amountCents : -amountCents,"
  print "            description: parsedIntent.description || '\''NL line'\''"
  print "          },"
  print "          {"
  print "            accountId: cashAccountId,"
  print "            accountName: parsedIntent.method || '\''Cash / Checking'\'',"
  print "            amountCents: isExpense ? -amountCents : amountCents,"
  print "            description: '\''Payment settlement'\''"
  print "          }"
  print "        ]"
  print "      });"
  print "      setQuery('\'');"
  print "      onClose();"
  print "    } else if (parsedIntent.type === '\''project'\'' && parsedIntent.projectName) {"
  print "      await addEntity('\''projects'\'', {"
  print "        name: parsedIntent.projectName,"
  print "        status: '\''active'\'',"
  print "        type: '\''general'\'',"
  print "        budgetCents: 0,"
  print "        dimensions: ['\''project'\''],"
  print "        description: '\''Created via Omnibox Command'\''"
  print "      }, `✨ Created project \"${parsedIntent.projectName}\"`);"
  print "      setQuery('\'');"
  print "      onClose();"
  print "    }"
  print "  };"
  next
}
in_func {
  if (/^  \};/) {
    in_func=0
  }
  next
}
{ print }
' src/components/layout/CommandPalette.tsx > temp.tsx && mv temp.tsx src/components/layout/CommandPalette.tsx
