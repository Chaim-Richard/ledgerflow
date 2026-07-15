const fs = require('fs');
let main = fs.readFileSync('src/main.tsx', 'utf8');

main = main.replace("import { ProtocolGuard } from './components/forensics/ProtocolGuard';", "");
main = main.replace(/<ProtocolGuard>/g, "");
main = main.replace(/<\/ProtocolGuard>/g, "");

fs.writeFileSync('src/main.tsx', main);

let rootLayout = fs.readFileSync('src/core/layout/RootLayout.tsx', 'utf8');
rootLayout = rootLayout.replace("import { ProtocolGuard } from '../../components/forensics/ProtocolGuard';", "");
rootLayout = rootLayout.replace(/<ProtocolGuard>/g, "");
rootLayout = rootLayout.replace(/<\/ProtocolGuard>/g, "");

fs.writeFileSync('src/core/layout/RootLayout.tsx', rootLayout);
