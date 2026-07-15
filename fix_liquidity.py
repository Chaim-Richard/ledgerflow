import re

with open('src/lib/algorithms/liquidity-projection.ts', 'r') as f:
    content = f.read()

content = content.replace("if (startingCash <= 0) startingCash = 500000; // Mock safety net if no cash detected", "if (startingCash < 0) startingCash = 0;")

with open('src/lib/algorithms/liquidity-projection.ts', 'w') as f:
    f.write(content)

