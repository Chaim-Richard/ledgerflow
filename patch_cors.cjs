const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');
if (!serverCode.includes("import cors from 'cors';")) {
  serverCode = serverCode.replace("import express from 'express';", "import express from 'express';\nimport cors from 'cors';");
  
  // Find where app = express() is
  const appDecl = `const app = express();`;
  if (serverCode.includes(appDecl)) {
     serverCode = serverCode.replace(appDecl, appDecl + "\n  app.use(cors());");
  } else {
     const startServer = `async function startServer() {\n  const app = express();`;
     serverCode = serverCode.replace(startServer, startServer + "\n  app.use(cors());");
  }
  fs.writeFileSync('server.ts', serverCode);
}
