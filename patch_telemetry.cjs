const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `const transactionsSnap = await db.collection("transactions").where("workspaceId", "in", workspacesSnap.docs.map(d => d.id).slice(0, 30)).get();`;
const replacement1 = `const wsIds = workspacesSnap.docs.map(d => d.id).slice(0, 30);
      let transactionsSnap = { docs: [] };
      if (wsIds.length > 0) {
          transactionsSnap = await db.collection("transactions").where("workspaceId", "in", wsIds).get();
      }`;
code = code.replace(target1, replacement1);
fs.writeFileSync('server.ts', code);
