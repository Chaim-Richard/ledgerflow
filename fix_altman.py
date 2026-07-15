import re

with open('src/lib/algorithms/altman-z-score.ts', 'r') as f:
    content = f.read()

content = re.sub(r'function seededRandom.*?return x - Math.floor\(x\);\n}\n', '', content, flags=re.DOTALL)
content = content.replace("const zScore = baseScore * inputs.wc + (seededRandom(seed++) * 0.5);", "const zScore = baseScore * inputs.wc;")
content = re.sub(r'let seed = .*?\n', '', content)

with open('src/lib/algorithms/altman-z-score.ts', 'w') as f:
    f.write(content)

