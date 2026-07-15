const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

if (!code.includes('dedupe')) {
  code = code.replace(
    'export default defineConfig({',
    'export default defineConfig({\n  resolve: { dedupe: ["react", "react-dom"] },'
  );
  fs.writeFileSync('vite.config.ts', code);
  console.log("Patched vite.config.ts");
}
