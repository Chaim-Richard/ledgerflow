const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');
if (!serverCode.includes("import cors from 'cors';")) {
  serverCode = serverCode.replace('import express from "express";', 'import express from "express";\nimport cors from "cors";');
  fs.writeFileSync('server.ts', serverCode);
}
