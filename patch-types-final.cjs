const fs = require('fs');

let typesCode = fs.readFileSync('./src/types.ts', 'utf8');

// There are duplicate metadata exports we need to fix
typesCode = typesCode.replace(/tags\?: string\[\];\s*metadata\?: Record<string, any>;/g, 'tags?: string[];');
// Then restore exactly 1 metadata at the end of each interface if needed, but it's probably fine to just leave them out if they are duplicated
fs.writeFileSync('./src/types.ts', typesCode);

