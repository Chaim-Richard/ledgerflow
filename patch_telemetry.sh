#!/bin/bash
sed -i 's/const workspacesSnap = await db.collection("workspaces").get();/const workspacesSnap = await db.collection("workspaces").limit(100).get();/g' server.ts
sed -i 's/const transactionsSnap = await db.collection("transactions").get();/const transactionsSnap = await db.collection("transactions").where("workspaceId", "in", workspacesSnap.docs.map(d => d.id).slice(0, 30)).get();/g' server.ts
