const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `async function verifyLockDate(workspaceId: string, date: string) {
  try {
    const db = getDb();
    const ws = await db.collection("workspaces").doc(workspaceId).get();
    if (ws.exists) {
      const data = ws.data();
      if (data?.lockDate && date <= data.lockDate) {
        throw new Error(\`Period Locked: Data mutation forbidden before \${data.lockDate}\`);
      }
    }
  } catch (err: any) {
    if (err.message?.includes("Period Locked")) {
      throw err;
    }
    console.warn("[Firebase Admin] Skipping period lockDate validation on write due to db connection/permission constraints:", err.message);
  }
}`;

const replacement = `async function verifyLockDate(workspaceId: string, date: string) {
  try {
    const db = getDb();
    const ws = await db.collection("workspaces").doc(workspaceId).get();
    if (ws.exists) {
      const data = ws.data();
      if (data?.lockDate && date <= data.lockDate) {
        throw new Error(\`Period Locked: Data mutation forbidden before \${data.lockDate}\`);
      }
    } else {
      throw new Error("Workspace not found");
    }
  } catch (err: any) {
    if (err.message?.includes("Period Locked") || err.message === "Workspace not found") {
      throw err;
    }
    throw new Error(\`Failed to verify period lock status: \${err.message}\`);
  }
}`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
