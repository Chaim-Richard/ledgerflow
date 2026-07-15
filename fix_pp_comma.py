with open('src/components/projects/ProjectPipeline.tsx', 'r') as f:
    content = f.read()

content = content.replace("}, [projects}]);", "}, [projects, transactions]);")

with open('src/components/projects/ProjectPipeline.tsx', 'w') as f:
    f.write(content)
