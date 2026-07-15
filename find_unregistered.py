import os
import glob

components = []
for root, dirs, files in os.walk('src/components'):
    for file in files:
        if file.endswith('.tsx') and file[0].isupper():
            components.append(file.replace('.tsx', ''))

with open('src/config/registry.tsx', 'r') as f:
    registry = f.read()

unregistered = []
for comp in components:
    if f"import('../components" in registry and comp in registry:
        continue
    if comp not in registry:
        unregistered.append(comp)

print("UNREGISTERED COMPONENTS:", len(unregistered))
for u in sorted(unregistered):
    print(" - " + u)
