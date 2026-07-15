with open('src/lib/algorithms/deep-math.ts', 'a') as f:
    f.write("\nexport const DEEP_MATH_ALGORITHMS = [\n  benfordsLawAuditor,\n  holtsSmoothingForecaster,\n  kMeansOutlierDetector,\n  macdCashFlow,\n  monteCarloVaR,\n  dupontIdentity\n];\n")

with open('src/lib/algorithms/index.ts', 'r') as f:
    content = f.read()

# Add the import
content = "import { DEEP_MATH_ALGORITHMS } from './deep-math';\n" + content

# Add them to FINANCIAL_ALGORITHMS
replacement = "  ...generateGenericAlgorithms(),\n"
for i in range(6):
    replacement += f"  'dm_{i}': DEEP_MATH_ALGORITHMS[{i}],\n"

content = content.replace("  ...generateGenericAlgorithms()", replacement)

with open('src/lib/algorithms/index.ts', 'w') as f:
    f.write(content)

