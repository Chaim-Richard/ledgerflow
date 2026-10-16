import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import WarehouseBinLocationsPanel from './WarehouseBinLocationsPanel';
import PickPackShipPanel from './PickPackShipPanel';
import ReturnAuthorizationsPanel from './ReturnAuthorizationsPanel';
import WarrantyRegisterPanel from './WarrantyRegisterPanel';

type WarehouseTab = 'bins' | 'pick-pack-ship' | 'returns' | 'warranties';
const tabs: Array<{ id: WarehouseTab; label: string }> = [
  { id: 'bins', label: 'Bin locations' },
  { id: 'pick-pack-ship', label: 'Pick, pack and ship' },
  { id: 'returns', label: 'Return authorizations' },
  { id: 'warranties', label: 'Warranty register' },
];

/** Operational subviews hosted inside Inventory Cycle Count to avoid changing the report registry. */
export default function WarehouseOperationsReportView() {
  const workspaceId = useAuthStore(state => state.currentWorkspaceId);
  const userId = useAuthStore(state => state.user?.uid || 'anonymous');
  const [activeTab, setActiveTab] = useState<WarehouseTab>('bins');
  const contextKey = `${workspaceId || 'no-workspace'}:${userId}`;
  const panelId = `warehouse-operations-panel-${activeTab}`;

  return <section aria-label="Warehouse operations" className="p-4 space-y-4 min-w-0">
    <h2>Warehouse operations</h2>
    <p className="text-sm text-[var(--muted)]">Warehouse notes live on existing inventory, sales-order and customer records. These workflows record bins, shipment tracking, return-authorization status and warranty dates only; actual stock movements, sales returns, invoices and credits remain in their existing workflows.</p>
    <div role="tablist" aria-label="Warehouse operations views" className="flex flex-wrap gap-2 border-b border-[var(--line)]" data-print-hide>
      {tabs.map(tab => <button key={tab.id} type="button" role="tab" id={`warehouse-operations-tab-${tab.id}`}
        aria-controls={`warehouse-operations-panel-${tab.id}`} aria-selected={activeTab === tab.id}
        tabIndex={activeTab === tab.id ? 0 : -1}
        className={`min-h-11 px-3 border-b-2 ${activeTab === tab.id ? 'border-[var(--brass)] font-semibold' : 'border-transparent text-[var(--muted)]'}`}
        onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div role="tabpanel" id={panelId} aria-labelledby={`warehouse-operations-tab-${activeTab}`} tabIndex={0}>
      {activeTab === 'bins' && <WarehouseBinLocationsPanel key={`${contextKey}:bins`} />}
      {activeTab === 'pick-pack-ship' && <PickPackShipPanel key={`${contextKey}:pick-pack-ship`} />}
      {activeTab === 'returns' && <ReturnAuthorizationsPanel key={`${contextKey}:returns`} />}
      {activeTab === 'warranties' && <WarrantyRegisterPanel key={`${contextKey}:warranties`} />}
    </div>
  </section>;
}
