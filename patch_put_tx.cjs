const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const targetStr = `await db.collection("transactions").doc(txId).set(updatedTx);`;
const replacement = `await db.collection("transactions").doc(txId).set(updatedTx);

      // Append to event-sourced journal entries
      if (updatedTx.lines && Array.isArray(updatedTx.lines)) {
         const batch = db.batch();
         updatedTx.lines.forEach((line: any, index: number) => {
             const eventRef = db.collection('journalEntries').doc(\`\${txId}-update-\${Date.now()}-line-\${index}\`);
             batch.set(eventRef, {
                 id: eventRef.id,
                 timestamp: new Date().toISOString(),
                 accountId: line.accountId,
                 amountCents: line.amountCents,
                 eventType: 'UPDATE',
                 transactionId: txId,
                 workspaceId: workspaceId,
                 description: line.description || updatedTx.description || ""
             });
         });
         await batch.commit();
      }
`;

serverCode = serverCode.replace(targetStr, replacement);
fs.writeFileSync('server.ts', serverCode);
