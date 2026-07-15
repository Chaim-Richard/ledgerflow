import re

files = [
    'src/components/finance/FactoringManager.tsx',
    'src/components/operations/DocumentManager.tsx',
    'src/components/sales/SubscriptionBilling.tsx',
    'src/components/operations/MaintenanceManager.tsx'
]

for file in files:
    try:
        with open(file, 'r') as f:
            content = f.read()
        
        # We need to remove any arrays defined as const [something] = [ ... ] or const [something] = useState([ ... ])
        # This regex might be a bit tricky. Let's just blindly replace the entire block inside useState([...]) 
        # But wait, it's safer to just replace const x = [ { ... } ] with const x: any[] = [];
        # Actually I can just leave them if they don't have mock data. Let me check if they have mock data first.
        
        content = re.sub(r'const factoringAgreements = \[.*?\];', 'const factoringAgreements: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const folders = \[.*?\];', 'const folders: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const documents = \[.*?\];', 'const documents: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const subs = \[.*?\];', 'const subs: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const plans = \[.*?\];', 'const plans: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const maintenanceSchedules = \[.*?\];', 'const maintenanceSchedules: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const equipment = \[.*?\];', 'const equipment: any[] = [];', content, flags=re.DOTALL)
        content = re.sub(r'const workOrders = \[.*?\];', 'const workOrders: any[] = [];', content, flags=re.DOTALL)
        
        with open(file, 'w') as f:
            f.write(content)
    except FileNotFoundError:
        pass
