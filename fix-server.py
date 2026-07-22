import os

with open('server.ts', 'r') as f:
    code = f.read()

target1 = """      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      const userDoc = await db.collection("users").doc(authReq.user.uid).get();
      const isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";"""

replacement1 = """      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }"""
      
target2 = """      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      const db = getDb();
      const userDoc = await db.collection("users").doc(authReq.user.uid).get();
      const isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";"""
      
replacement2 = """      const isSystemAdmin = authReq.user.email?.toLowerCase() === 'shmuelbiller@gmail.com';
      const db = getDb();
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }"""

code = code.replace(target1, replacement1)
code = code.replace(target2, replacement2)

with open('server.ts', 'w') as f:
    f.write(code)
