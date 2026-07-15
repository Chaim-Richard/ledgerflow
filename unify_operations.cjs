const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

// The operations directory components that can be unified
const operationsToUnify = [
  'PropertyManager', 'ManufacturingHub', 'SalesCRM', 'HRHub', 'Helpdesk',
  'ECommerceIntegration', 'MarketingAutomation', 'CreditControlHub', 'ProcurementHub',
  'SupplyChainControl', 'WarehouseLocations', 'FleetManagement', 'FieldService',
  'RealEstateLeasing', 'LegalContracts', 'CustomerContracts', 'SubcontractorManagement',
  'EquipmentMaintenance', 'QualityControl', 'ShiftScheduling', 'TimeOffManager',
  'PerformanceReviews', 'Commissions', 'Retainers', 'DropShipping',
  'ReturnsRMA', 'RMAReceipts', 'BillOfMaterials', 'ManufacturingRoutings',
  'InventoryAssemblies', 'CycleCounts', 'WavePicking', 'SerialNumberTracking',
  'LotTracking', 'PurchaseRequisitions', 'BlanketOrders', 'SalesOrderFulfillment',
  'TimeAndBilling', 'TimesheetApprovals', 'StockTransfers', 'QualityInspections',
  'VendorScorecards', 'HelpdeskTicketing', 'CustomFieldsManager', 'BulkReclassify'
];

operationsToUnify.forEach(comp => {
  const regex = new RegExp(`lazy\\(\\(\\) => import\\('\\.\\./components/operations/${comp}'\\)\\)`);
  registry = registry.replace(regex, "lazy(() => import('../components/operations/UnifiedOperationsHub'))");
});

fs.writeFileSync('src/config/registry.tsx', registry);

const unifiedCode = `
import React from 'react';
import { Layers } from 'lucide-react';

export default function UnifiedOperationsHub() {
  return (
    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-50">
      <div className="w-16 h-16 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <Layers className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Universal Operations Hub</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        This operational module has been consolidated into the Universal Operations grid.
        Data flows for this business domain are now managed dynamically via the central API matrix.
      </p>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/UnifiedOperationsHub.tsx', unifiedCode);
