import re

files = [
    'src/components/operations/QualityControl.tsx',
    'src/components/operations/PropertyManager.tsx',
    'src/components/operations/FieldService.tsx',
    'src/components/sales/PricingEngine.tsx',
    'src/components/operations/FleetLogistics.tsx',
    'src/components/operations/SupportHelpdesk.tsx',
    'src/components/operations/ManufacturingBOM.tsx',
    'src/components/finance/RevenueRecognition.tsx',
]

for file in files:
    with open(file, 'r') as f:
        print(f"{file}: Mock Array Count: {len(re.findall(r'const [a-zA-Z0-9]+ = \[.*?\];', f.read(), flags=re.DOTALL))}")

