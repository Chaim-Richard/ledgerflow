const fs = require('fs');

let palette = fs.readFileSync('src/components/layout/CommandPalette.tsx', 'utf8');
palette = palette.replace(/import { SYSTEM_COMMANDS } from '\.\.\/\.\.\/config\/registry';/, `import { SYSTEM_COMMANDS, ANALYTICAL_LENSES_REGISTRY } from '../../config/registry';`);

palette = palette.replace(/return SYSTEM_COMMANDS\.map\(cmd => \(\{\n\s*id: cmd.id,/, `
    const baseCommands = SYSTEM_COMMANDS.map(cmd => ({
      id: cmd.id,
      label: cmd.label[language] || cmd.label['en'],
      category: cmd.category,
      actionId: cmd.actionId,
      payload: cmd.payload
    }));

    const lensCommands = ANALYTICAL_LENSES_REGISTRY.map(lens => ({
      id: \`lens-\${lens.id}\`,
      label: lens.label[language] || lens.label['en'],
      category: 'Calculators & Tools',
      actionId: 'switch-tab',
      payload: { tab: 'intelligence' } // Need a way to jump directly to the specific lens. We will handle that.
    }));

    return [...baseCommands, ...lensCommands];
  }, [language]); // removing the old return block
//`);

// Wait, the replace string is a bit tricky, let's just write a script to re-write the localizedCommands logic directly.
