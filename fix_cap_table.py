import re

file = 'src/components/finance/CapTableManager.tsx'
with open(file, 'r') as f:
    content = f.read()

content = re.sub(r'const shareholders = \[.*?\];', 'const shareholders: any[] = [];', content, flags=re.DOTALL)
content = re.sub(r'const certificates = \[.*?\];', 'const certificates: any[] = [];', content, flags=re.DOTALL)
content = re.sub(r'const grants = \[.*?\];', 'const grants: any[] = [];', content, flags=re.DOTALL)

with open(file, 'w') as f:
    f.write(content)

