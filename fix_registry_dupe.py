with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find("mport { lazy } from 'react';")
if idx != -1:
    content = content[:idx] # Keep the '}' that was before the 'i'
    
with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
