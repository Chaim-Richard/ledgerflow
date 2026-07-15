with open('src/components/projects/ProjectPipeline.tsx', 'r') as f:
    content = f.read()

content = content.replace("export default function ProjectPipeline{ projects", "export default function ProjectPipeline({ projects")

with open('src/components/projects/ProjectPipeline.tsx', 'w') as f:
    f.write(content)
