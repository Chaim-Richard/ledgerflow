import re

files = [
    'src/components/operations/ManufacturingBOM.tsx',
    'src/components/operations/SupportHelpdesk.tsx',
    'src/components/finance/RevenueRecognition.tsx',
    'src/components/operations/FleetLogistics.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Replace the arrays with empty arrays
    content = re.sub(r'const boms = \[.*?\];', 'const boms: any[] = [];', content, flags=re.DOTALL)
    content = re.sub(r'const workOrders = \[.*?\];', 'const workOrders: any[] = [];', content, flags=re.DOTALL)
    content = re.sub(r'const tickets = \[.*?\];', 'const tickets: any[] = [];', content, flags=re.DOTALL)
    content = re.sub(r'const schedules = \[.*?\];', 'const schedules: any[] = [];', content, flags=re.DOTALL)
    content = re.sub(r'const waterfallData = \[.*?\];', 'const waterfallData: any[] = [];', content, flags=re.DOTALL)
    content = re.sub(r'const fleet = \[.*?\];', 'const fleet: any[] = [];', content, flags=re.DOTALL)
    
    with open(file, 'w') as f:
        f.write(content)

