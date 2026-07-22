const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      const userDoc = await db.collection("users").doc(authReq.user.uid).get();
      const isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";`;

const replacement = `      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }`;

code = code.split(target).join(replacement);

const target2 = `      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      const db = getDb();
      const userDoc = await db.collection("users").doc(authReq.user.uid).get();
      const isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";`;

const replacement2 = `      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      const db = getDb();
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }`;
      
code = code.split(target2).join(replacement2);

fs.writeFileSync('server.ts', code);
