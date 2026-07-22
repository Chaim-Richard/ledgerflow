# Clearbook Plugin System 🔌

Clearbook includes an ultra-efficient, zero-configuration plugin system.
This answers the request to "plug in afew lins of code, to the data, and if deleat just plug out nd chang file".

If you want to create a new tool or tab, you **do not** need to edit `registry.tsx` or `App.tsx`.

## How to add a Custom Tool

1. Create a `.tsx` file inside `src/plugins/`. (For example: `MyTool.tsx`)
2. Export a `config` object containing the `id`, `label`, `icon`, and `groupId`.
3. Default export a React component. 

That is IT! It will automatically appear in the sidebar navigation AND register its view component. 
If you want to remove the tool, just delete the file.

### Plugin Template

```tsx
import React from 'react';
import { Target } from 'lucide-react';
import { useSystemProps, useCommandDispatcher } from '../hooks/useSystemContext';

export const config = {
  id: 'my-custom-tool',
  label: { en: 'Custom Tool', he: 'כלי מותאם אישית' },
  icon: Target,
  groupId: 'insights', // 'insights' | 'operations' | 'audit_system'
};

export default function MyCustomTool() {
  // Connect to the entire system data magically!
  const { handleAction } = useCommandDispatcher();
  const system = useSystemProps(handleAction);

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold">Total Transactions: {system.transactions.length}</h1>
    </div>
  );
}
```

## Data Connection

All plugins can access EXACTLY the same data context that the core system tabs use.
Simply import `useCommandDispatcher` and `useSystemProps` to read state, dispatch actions, and format currency.
