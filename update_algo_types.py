with open('src/lib/algorithms/types.ts', 'r') as f:
    content = f.read()

content = content.replace("export interface AlgorithmDefinition {", "export interface AlgorithmDefinition {\n  domain?: 'finance' | 'operations' | 'forensics' | 'planning' | 'treasury' | 'system';\n  tags?: string[];")

with open('src/lib/algorithms/types.ts', 'w') as f:
    f.write(content)
