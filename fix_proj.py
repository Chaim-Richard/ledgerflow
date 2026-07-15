with open('src/components/projects/ProjectPipeline.tsx', 'r') as f:
    content = f.read()

content = content.replace("({ projects,({ onUpdateProject }", "{ projects, onUpdateProject }")

content = content.replace("}: ProjectPipelineProps) {", "}: ProjectPipelineProps) {\n  const transactions = useLedgerStore(state => state.transactions || []);")

with open('src/components/projects/ProjectPipeline.tsx', 'w') as f:
    f.write(content)
