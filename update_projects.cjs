const fs = require('fs');
const file = 'src/components/projects/Projects.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/interface ProjectsProps {[\s\S]*?}/, '');
content = content.replace(/export default function Projects\(\{[\s\S]*?\}\: ProjectsProps\) \{/, 'import { useAuthStore } from \'../../stores/useAuthStore\';\nimport { useLedgerStore } from \'../../stores/useLedgerStore\';\nimport { useCommandDispatcher } from \'../../hooks/useSystemContext\';\nimport { useEntityOperations } from \'../../hooks/useEntityOperations\';\n\nexport default function Projects() {\n  const user = useAuthStore(s => s.user);\n  const projects = useLedgerStore(s => s.projects);\n  const transactions = useLedgerStore(s => s.transactions);\n  const budgets = useLedgerStore(s => s.budgets);\n  const vendors = useLedgerStore(s => s.vendors);\n  const { handleAction: onAction } = useCommandDispatcher();\n  const { addEntity, updateEntity, deleteEntity } = useEntityOperations();\n  const onAdd = (data: any) => addEntity(\'projects\', data);\n  const onUpdate = (id: string, data: any) => updateEntity(\'projects\', id, data);\n  const onDelete = (id: string) => deleteEntity(\'projects\', id);');

fs.writeFileSync(file, content);
