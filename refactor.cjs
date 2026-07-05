const fs = require('fs');
fs.mkdirSync('src/server/routes', { recursive: true });
fs.mkdirSync('src/server/middlewares', { recursive: true });
console.log('Directories created');
