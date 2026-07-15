import re

with open('src/lib/algorithms/index.ts', 'r') as f:
    content = f.read()

if "import { ERP_MODELS } from './erp-models';" not in content:
    content = content.replace(
        "import { generateGenericAlgorithms } from './generic-algorithms';",
        "import { generateGenericAlgorithms } from './generic-algorithms';\nimport { ERP_MODELS } from './erp-models';"
    )

    content = content.replace(
        "  'dm_5': DEEP_MATH_ALGORITHMS[5],",
        "  'dm_5': DEEP_MATH_ALGORITHMS[5],\n  'erp_0': ERP_MODELS[0],\n  'erp_1': ERP_MODELS[1],\n  'erp_2': ERP_MODELS[2],\n  'erp_3': ERP_MODELS[3],"
    )

    with open('src/lib/algorithms/index.ts', 'w') as f:
        f.write(content)
