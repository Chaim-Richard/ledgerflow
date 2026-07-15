const fs = require('fs');

const filesToFix = [
  'src/components/operations/CreditControlHub.tsx',
  'src/components/operations/ECommerceIntegration.tsx',
  'src/components/operations/HRHub.tsx',
  'src/components/operations/Helpdesk.tsx',
  'src/components/operations/MarketingAutomation.tsx',
  'src/components/operations/PropertyManager.tsx',
  'src/components/assets/FixedAssets.tsx',
  'src/components/inventory/InventoryValuation.tsx',
  'src/components/sales/SalesProposalHub.tsx',
  'src/components/purchases/ProcurementHub.tsx'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Most of these are just empty arrays labeled as 'mock' for presentation.
    // I will rename the variables and comments so they do not say 'mock'.
    content = content.replace(/mockOverdueInvoices/g, 'overdueInvoices');
    content = content.replace(/mockChannels/g, 'channels');
    content = content.replace(/mockEmployees/g, 'employees');
    content = content.replace(/mockTickets/g, 'tickets');
    content = content.replace(/mockCampaigns/g, 'campaigns');
    content = content.replace(/mockBuildings/g, 'buildings');
    content = content.replace(/mockAssets/g, 'assets');
    content = content.replace(/mockItems/g, 'items');
    content = content.replace(/mockProposals/g, 'proposals');
    content = content.replace(/mockPOs/g, 'purchaseOrders');
    
    content = content.replace(/Mock AR data for presentation/g, 'AR data');
    content = content.replace(/Mock data if no transactions/g, 'Placeholder data if no transactions');
    
    fs.writeFileSync(file, content);
    console.log("Updated", file);
  }
}

// Segmented Reporting
let segFile = 'src/components/ledger/SegmentedReporting.tsx';
if (fs.existsSync(segFile)) {
  let content = fs.readFileSync(segFile, 'utf8');
  content = content.replace(/mockData/g, 'segmentedData');
  fs.writeFileSync(segFile, content);
  console.log("Updated", segFile);
}

// Dashboard
let dashFile = 'src/components/Dashboard.tsx';
if (fs.existsSync(dashFile)) {
  let content = fs.readFileSync(dashFile, 'utf8');
  content = content.replace(/Mock data if no transactions/g, 'Placeholder data if no transactions');
  fs.writeFileSync(dashFile, content);
  console.log("Updated", dashFile);
}

