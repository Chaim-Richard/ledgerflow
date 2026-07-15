with open('src/lib/algorithms/generic-algorithms.ts', 'r') as f:
    content = f.read()

import re

# We will add domain and tags dynamically
content = content.replace("const genericToolDefs = [", """
const DOMAINS = ['finance', 'operations', 'forensics', 'planning', 'treasury'];
const genericToolDefs = [""")

content = content.replace("return {\n      id: tool.id,\n      name: tool.name,\n      description: tool.desc,\n      inputs: [", """return {
      id: tool.id,
      name: tool.name,
      description: tool.desc,
      domain: DOMAINS[parseInt(tool.id) % DOMAINS.length] as any,
      tags: ['machine-learning', 'heuristic', 'batch-processing'].slice(0, (parseInt(tool.id) % 3) + 1),
      inputs: [""")

with open('src/lib/algorithms/generic-algorithms.ts', 'w') as f:
    f.write(content)
