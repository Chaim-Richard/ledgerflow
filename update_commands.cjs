const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

// I need to add commands dynamically.
// I will just read ANALYTICAL_LENSES_REGISTRY from the file, and then build the new commands and append them.
// But it's easier to just export a combined list of commands in CommandPalette.tsx.
