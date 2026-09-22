import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem, Bill } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { performThreeWayMatch, ThreeWayMatchSummary } from '../../lib/threeWayMatchEngine';
import { formatCurrency, formatDate } from '../../lib/utils';
import { RequireRole } from '../ui/RequireRole';
import { useTimeout } from '../../hooks/useTimeout';
import { 
  ShoppingCart, 
  Plus, 
  PackageCheck, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  FileCheck, 
  ShieldCheck, 
  Search,
  X,
  Check,
  Building,
  DollarSign
} from 'lucide-react';

export const PurchaseOrdersView: React.FC = () => {
  const bills = useLedgerStore(s => (s.bills || []) as Bill[]);
  const accounts = useLedgerStore(s => s.accounts);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const currentWorkspace = getCurrentWorkspace();

  // Local state for POs and Receipts (or persistent in store)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    return [
      {
        id: 'po_demo_101',
        uid: 'system',
        workspaceId: currentWorkspace?.id || 'default',
        poNumber: 'PO-2026-001',
        vendorId: 'vend_aws',
        vendorName: 'Acme Hardware Supplies',
        issueDate: '2026-02-15',
        expectedDeliveryDate: '2026-02-28',
        status: 'received',
        items: [
          {
            id: 'item_1',
            description: 'Ergonomic Desk Stations',
            quantity: 5,
            unitPriceCents: 45000,
            totalCents: 225000,
            receivedQuantity: 5
          }
        ],
        totalAmountCents: 225000,
        createdAt: '2026-02-15T10:00:00Z'
      }
    ];
  });

  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>(() => {
    return [
      {
        id: 'gr_demo_101',
        uid: 'system',
        workspaceId: currentWorkspace?.id || 'default',
        receiptNumber: 'GR-2026-001',
        poId: 'po_demo_101',
        poNumber: 'PO-2026-001',
        vendorId: 'vend_aws',
        vendorName: 'Acme Hardware Supplies',
        receivedDate: '2026-02-26',
        items: [
          {
            poItemId: 'item_1',
            description: 'Ergonomic Desk Stations',
            quantityReceived: 5,
            unitPriceCents: 45000,
            condition: 'good'
          }
        ],
        status: 'verified',
        createdAt: '2026-02-26T14:00:00Z'
      }
    ];
  });

  const [activeTab, setActiveTab] = useState<'pos' | 'match' | 'receipts'>('pos');
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { setSafeTimeout } = useTimeout();

  // Form State
  const [poVendor, setPoVendor] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [poItems, setPoItems] = useState<Array<{ desc: string; qty: string; unitPrice: string }>>([
    { desc: '', qty: '1', unitPrice: '' }
  ]);

  // Receiving Form State
  const [receivedCondition, setReceivedCondition] = useState<'good' | 'damaged' | 'rejected'>('good');
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  // 3-Way Match evaluation
  const matchSummary = useMemo(() => {
    return performThreeWayMatch(purchaseOrders, goodsReceipts, bills);
  }, [purchaseOrders, goodsReceipts, bills]);

  const handleSavePO = () => {
    if (!poVendor || poItems.some(i => !i.desc || !i.unitPrice)) return;

    let totalCents = 0;
    const items: PurchaseOrderItem[] = poItems.map((item, idx) => {
      const qty = parseFloat(item.qty) || 1;
      const priceCents = Math.round(parseFloat(item.unitPrice) * 100);
      const lineCents = Math.round(qty * priceCents);
      totalCents += lineCents;

      return {
        id: `item_${Date.now()}_${idx}`,
        description: item.desc,
        quantity: qty,
        unitPriceCents: priceCents,
        totalCents: lineCents
      };
    });

    const newPO: PurchaseOrder = {
      id: `po_${Date.now()}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      poNumber: `PO-2026-${String(purchaseOrders.length + 1).padStart(3, '0')}`,
      vendorId: `vend_${Date.now()}`,
      vendorName: poVendor,
      issueDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: poExpectedDate,
      status: 'approved',
      items,
      totalAmountCents: totalCents,
      createdAt: new Date().toISOString()
    };

    setPurchaseOrders([...purchaseOrders, newPO]);
    setIsCreatingPO(false);
    setPoVendor('');
    setPoItems([{ desc: '', qty: '1', unitPrice: '' }]);
    setSuccessMessage(`Created Purchase Order ${newPO.poNumber} for ${poVendor}`);
    setSafeTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleOpenReceive = (po: PurchaseOrder) => {
    setReceivingPO(po);
    const initialQty: Record<string, number> = {};
    po.items.forEach(item => {
      initialQty[item.id] = item.quantity;
    });
    setReceivedQuantities(initialQty);
  };

  const handleSaveGoodsReceipt = () => {
    if (!receivingPO) return;

    const receiptItems: GoodsReceiptItem[] = receivingPO.items.map(item => ({
      poItemId: item.id,
      description: item.description,
      quantityReceived: receivedQuantities[item.id] ?? item.quantity,
      unitPriceCents: item.unitPriceCents,
      condition: receivedCondition
    }));

    const newReceipt: GoodsReceipt = {
      id: `gr_${Date.now()}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      receiptNumber: `GR-2026-${String(goodsReceipts.length + 1).padStart(3, '0')}`,
      poId: receivingPO.id,
      poNumber: receivingPO.poNumber,
      vendorId: receivingPO.vendorId,
      vendorName: receivingPO.vendorName,
      receivedDate: new Date().toISOString().split('T')[0],
      items: receiptItems,
      status: receivedCondition === 'good' ? 'verified' : 'discrepancy',
      createdAt: new Date().toISOString()
    };

    // Update PO status
    const updatedPOs = purchaseOrders.map(p => p.id === receivingPO.id ? { ...p, status: 'received' as const } : p);

    setGoodsReceipts([...goodsReceipts, newReceipt]);
    setPurchaseOrders(updatedPOs);
    setReceivingPO(null);
    setSuccessMessage(`Goods Receipt ${newReceipt.receiptNumber} recorded. Ready for 3-Way Match.`);
    setSafeTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="purchase-orders-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-neutral-800" />
            Purchase Orders & 3-Way Matching
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Reconcile Purchase Orders, Goods Receipts, and Supplier Invoices to eliminate overpayments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreatingPO(true)}
            className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            id="create-po-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 bg-neutral-100/60 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'pos' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Purchase Orders ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('match')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'match' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          3-Way Match Monitor ({matchSummary.varianceCount} Discrepancies)
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'receipts' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Goods Receipts ({goodsReceipts.length})
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'pos' && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Expected Delivery</th>
                <th className="py-3 px-4 text-right">Order Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {purchaseOrders.map(po => (
                <tr key={po.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                    {po.poNumber}
                  </td>
                  <td className="py-3 px-4 font-medium text-neutral-800">
                    {po.vendorName}
                  </td>
                  <td className="py-3 px-4 text-neutral-600 font-mono">
                    {formatDate(po.issueDate)}
                  </td>
                  <td className="py-3 px-4 text-neutral-600 font-mono">
                    {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                    {formatCurrency(po.totalAmountCents)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      po.status === 'received'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {po.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {po.status !== 'received' && (
                      <button
                        onClick={() => handleOpenReceive(po)}
                        className="px-2.5 py-1 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-md transition-colors"
                      >
                        Receive Goods
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'match' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
              <div className="text-xs font-semibold text-neutral-500 uppercase">Fully Matched Orders</div>
              <div className="text-xl font-mono font-bold text-emerald-600 mt-1">
                {matchSummary.matchedCount}
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
              <div className="text-xs font-semibold text-neutral-500 uppercase">Price / Qty Variances</div>
              <div className="text-xl font-mono font-bold text-amber-600 mt-1">
                {matchSummary.varianceCount}
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
              <div className="text-xs font-semibold text-neutral-500 uppercase">Awaiting Delivery</div>
              <div className="text-xl font-mono font-bold text-neutral-700 mt-1">
                {matchSummary.unreceivedCount}
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
              <div className="text-xs font-semibold text-neutral-500 uppercase">Awaiting Supplier Bill</div>
              <div className="text-xl font-mono font-bold text-indigo-600 mt-1">
                {matchSummary.missingBillCount}
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">PO Reference</th>
                  <th className="py-3 px-4 text-right">PO Amount</th>
                  <th className="py-3 px-4 text-right">Received Amount</th>
                  <th className="py-3 px-4 text-right">Billed Amount</th>
                  <th className="py-3 px-4 text-center">Match Status</th>
                  <th className="py-3 px-4">Validation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {matchSummary.results.map((res, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {res.poNumber}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-700">
                      {formatCurrency(res.poAmountCents)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-700">
                      {formatCurrency(res.receiptAmountCents)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-700">
                      {res.billAmountCents > 0 ? formatCurrency(res.billAmountCents) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        res.status === 'matched'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : res.status === 'unreceived'
                          ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {res.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 text-[11px]">
                      {res.discrepancies.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          <div className="space-y-0.5 text-amber-700">
                            {res.discrepancies.map((d, i) => (
                              <div key={i}>&bull; {d}</div>
                            ))}
                          </div>
                          <RequireRole role="owner" disableOnly tooltip="Only the workspace owner can override exceptions">
                            <button className="self-start px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold uppercase tracking-wider text-[9px] transition-colors">
                              Approve Anyway
                            </button>
                          </RequireRole>
                        </div>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          3-Way Reconciled (PO = GR = Bill)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'receipts' && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">PO Linked</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Received Date</th>
                <th className="py-3 px-4">Items Inspected</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {goodsReceipts.map(gr => (
                <tr key={gr.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                    {gr.receiptNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-neutral-700">
                    {gr.poNumber}
                  </td>
                  <td className="py-3 px-4 font-medium text-neutral-800">
                    {gr.vendorName || 'Vendor'}
                  </td>
                  <td className="py-3 px-4 text-neutral-600 font-mono">
                    {formatDate(gr.receivedDate)}
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    {gr.items.map(i => `${i.description} (${i.quantityReceived} units)`).join(', ')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-semibold">
                      VERIFIED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create PO Modal */}
      {isCreatingPO && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <h3 className="text-sm font-bold text-neutral-900">Create Purchase Order</h3>
              <button onClick={() => setIsCreatingPO(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Vendor / Supplier</label>
                  <input
                    type="text"
                    placeholder="e.g. Dell Enterprise Hardware"
                    value={poVendor}
                    onChange={e => setPoVendor(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={e => setPoExpectedDate(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="block font-semibold text-neutral-700">Line Items</label>
                {poItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2">
                    <input
                      type="text"
                      placeholder="Item description"
                      value={item.desc}
                      onChange={e => {
                        const updated = [...poItems];
                        updated[idx].desc = e.target.value;
                        setPoItems(updated);
                      }}
                      className="col-span-3 p-2 bg-white border border-neutral-300 rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={e => {
                        const updated = [...poItems];
                        updated[idx].qty = e.target.value;
                        setPoItems(updated);
                      }}
                      className="col-span-1 p-2 bg-white border border-neutral-300 rounded-lg text-center"
                    />
                    <input
                      type="number"
                      placeholder="Unit Price ($)"
                      value={item.unitPrice}
                      onChange={e => {
                        const updated = [...poItems];
                        updated[idx].unitPrice = e.target.value;
                        setPoItems(updated);
                      }}
                      className="col-span-2 p-2 bg-white border border-neutral-300 rounded-lg text-right font-mono"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPoItems([...poItems, { desc: '', qty: '1', unitPrice: '' }])}
                className="text-xs text-neutral-700 hover:text-neutral-900 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Line
              </button>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingPO(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePO}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Issue Purchase Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goods Receipt Modal */}
      {receivingPO && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <h3 className="text-sm font-bold text-neutral-900">Record Goods Receipt ({receivingPO.poNumber})</h3>
              <button onClick={() => setReceivingPO(null)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Inspection Condition</label>
                <select
                  value={receivedCondition}
                  onChange={e => setReceivedCondition(e.target.value as any)}
                  className="w-full p-2 bg-white border border-neutral-300 rounded-lg"
                >
                  <option value="good">Good Condition (Accept All)</option>
                  <option value="damaged">Damaged Goods (Flag Discrepancy)</option>
                  <option value="rejected">Rejected Delivery</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-neutral-700">Delivered Quantities</label>
                {receivingPO.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                    <span className="font-medium text-neutral-800">{item.description}</span>
                    <input
                      type="number"
                      value={receivedQuantities[item.id] ?? item.quantity}
                      onChange={e => setReceivedQuantities({ ...receivedQuantities, [item.id]: parseFloat(e.target.value) || 0 })}
                      className="w-16 p-1 bg-white border border-neutral-300 rounded-md text-center"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReceivingPO(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoodsReceipt}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Goods Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersView;
