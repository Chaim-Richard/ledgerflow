import React, { useState, useMemo } from 'react';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import InlineEdit from '../ui/InlineEdit';
import InlineAdd from '../ui/InlineAdd';
import { suggestionsFrom } from '../../lib/inlineEdit';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { ShoppingBag, Plus, Search, Trash2, CheckCircle, AlertCircle, DollarSign, Ban, Download, Pencil, Printer } from 'lucide-react';
import PdfPreviewModal from '../ui/PdfPreviewModal';
import DocumentBulkBar from '../ui/DocumentBulkBar';
import { useAuthStore } from '../../stores/useAuthStore';
import type { Bill, Vendor } from '../../types';
import { useRecordFocus, recordElementId } from '../../hooks/useRecordFocus';
import { formatCurrency, safeConfirm } from '../../lib/utils';
import BillModal from './BillModal';
import VendorModal from './VendorModal';
import TagFilter from '../common/TagFilter';
import { allTags, hasTag, isArchivedParty } from '../../lib/contacts';
import PartyRowActions, { ArchivedBadge, ShowArchivedToggle } from '../common/PartyRowActions';
import VendorDetailView from './VendorDetailView';
import ReceivePaymentModal from '../sales/ReceivePaymentModal';
import { toast } from 'sonner';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { LoadingState } from '../ui/LoadingState';
import { csvMoney, downloadCsv } from '../../lib/csvExport';

const NO_VENDORS: Vendor[] = [];
const NO_BILLS: Bill[] = [];

export default function Purchases() {
  const vendors = useLedgerStore(s => s.vendors) ?? NO_VENDORS;
  const bills = useLedgerStore(s => s.bills) ?? NO_BILLS;
  const accounts = useLedgerStore(s => s.accounts) || [];
  const { loading } = useLedgerCollections('bills', 'vendors');
  const { addEntity, updateEntity, deleteEntity } = useEntityOperations();
  const canEditContacts = useCurrentRole() !== 'viewer';

  const [activeSubTab, setActiveSubTab] = useState<'bills' | 'vendors'>('bills');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Partial<Bill> | undefined>(undefined);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);
  const [pickedBills, setPickedBills] = useState<Set<string>>(() => new Set());
  const pdfWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  // A record link (#purchases/bill/<id>, e.g. from Data Health) shows and highlights the bill
  const focusedBillId = useRecordFocus('bill', { ready: bills.length > 0, onFocus: () => { setActiveSubTab('bills'); setSelectedVendorId(null); setSearchTerm(''); } });
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDocumentId, setPaymentDocumentId] = useState<string | null>(null);
  const [paymentContactId, setPaymentContactId] = useState<string | null>(null);

  // Filter bills based on search term (vendor name, number, etc.)
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const vendorName = b.vendorName || '';
      const billNumber = b.number || '';
      const matchText = `${vendorName} ${billNumber}`.toLowerCase();
      return matchText.includes(searchTerm.toLowerCase());
    });
  }, [bills, searchTerm]);

  // Filter vendors based on search term
  const [vendorTag, setVendorTag] = useState<string | null>(null);
  const vendorTags = useMemo(() => allTags(vendors), [vendors]);
  const vendorCategories = useMemo(() => suggestionsFrom(vendors, v => v.category), [vendors]);
  const [showArchivedVendors, setShowArchivedVendors] = useState(false);
  const archivedVendors = useMemo(() => vendors.filter(isArchivedParty).length, [vendors]);
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchText = `${v.name} ${v.email || ''} ${v.phone || ''} ${v.category || ''} ${(v.tags || []).join(' ')}`.toLowerCase();
      return matchText.includes(searchTerm.toLowerCase()) && hasTag(v, vendorTag) && (showArchivedVendors || !isArchivedParty(v));
    });
  }, [vendors, searchTerm, vendorTag, showArchivedVendors]);

  const handleAddVendor = async (data: Partial<Vendor>) => {
    await addEntity('vendors', data, 'Vendor successfully created');
    setIsVendorModalOpen(false);
  };

  const handleAddBill = async (data: Partial<Bill>) => {
    if (data.id) {
      const { id, ...updates } = data;
      await updateEntity('bills', id, updates, 'Bill updated');
    } else {
      await addEntity('bills', data, 'Bill successfully recorded');
    }
    setIsBillModalOpen(false);
    setEditingBill(undefined);
  };

  const describeBill = (b: Bill) => `bill ${b.number || ''} from ${b.vendorName || 'this vendor'} (${formatCurrency(b.amountCents || 0, b.currency)})`.replace('bill  from', 'bill from');

  // Only drafts can be deleted (the database keeps issued bills; void them instead)
  const handleDeleteBill = async (b: Bill) => {
    if (safeConfirm(`Delete the draft ${describeBill(b)}? This can't be undone.`)) {
      await deleteEntity('bills', b.id, 'Draft bill deleted');
    }
  };

  const handleVoidBill = async (b: Bill) => {
    if (safeConfirm(`Void ${describeBill(b)}? It stays on record as void and its entries are reversed.`)) {
      await updateEntity('bills', b.id, { status: 'void' }, 'Bill voided');
    }
  };

  const exportBillsToCSV = () => {
    downloadCsv('bills_export.csv',
      ['Vendor Name', 'Bill Number', 'Date', 'Due Date', 'Status', 'Amount', 'Currency'],
      filteredBills.map(b => [b.vendorName || 'Unknown Vendor', b.number || b.id, b.date || '', b.dueDate || '', b.status || 'unpaid', csvMoney(b.amountCents || 0), b.currency || '']));
    toast.success('Bills exported successfully to CSV');
  };

  if (selectedVendorId) {
    return (
      <VendorDetailView 
        vendorId={selectedVendorId} 
        onBack={() => setSelectedVendorId(null)} 
      />
    );
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Purchases Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-500" />
            Purchases & AP
          </h1>
          <p className="text-sm text-[var(--muted)] dark:text-slate-400">
            Manage vendor bills, purchase orders, vendors, and Accounts Payable accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeSubTab === 'bills' && (
            <button
              onClick={exportBillsToCSV}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors border border-slate-200 dark:border-slate-800"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => {
              if (activeSubTab === 'bills') {
                setEditingBill(undefined);
                setIsBillModalOpen(true);
              } else {
                setIsVendorModalOpen(true);
              }
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeSubTab === 'bills' ? 'Record Bill' : 'Add Vendor'}
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6">
        <button
          onClick={() => { setActiveSubTab('bills'); setSearchTerm(''); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'bills'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-[var(--muted)] dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Bills ({bills.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('vendors'); setSearchTerm(''); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'vendors'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-[var(--muted)] dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Vendors ({vendors.length})
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-xs">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-[var(--muted)]" />
        </span>
        <input
          type="text"
          placeholder={activeSubTab === 'bills' ? 'Search bills...' : 'Search vendors...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-xs focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Main Tables Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {activeSubTab === 'bills' ? (
          <div className="overflow-x-auto">
            {pdfWorkspaceId && (
              <DocumentBulkBar type="bill" noun="bill" ids={[...pickedBills].filter(id => filteredBills.some(b => b.id === id))}
                documents={filteredBills.filter(b => pickedBills.has(b.id))}
                workspaceId={pdfWorkspaceId} onClear={() => setPickedBills(new Set())} />
            )}
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Bills</caption>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  <th scope="col" className="pl-4 w-8">
                    <input type="checkbox" aria-label="Select all bills shown"
                      checked={filteredBills.length > 0 && filteredBills.every(b => pickedBills.has(b.id))}
                      onChange={e => setPickedBills(e.target.checked ? new Set(filteredBills.map(b => b.id)) : new Set())} />
                  </th>
                  <th scope="col" className="p-4">Vendor</th>
                  <th scope="col" className="p-4">Bill #</th>
                  <th scope="col" className="p-4">Date</th>
                  <th scope="col" className="p-4">Due Date</th>
                  <th scope="col" className="p-4">Status</th>
                  <th scope="col" className="p-4 text-right">Amount</th>
                  <th scope="col" className="p-4 w-10"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredBills.map(b => {
                  const isOverdue = b.dueDate && new Date(b.dueDate) < new Date() && b.status !== 'paid' && b.status !== 'void';
                  return (
                    <tr key={b.id} id={recordElementId('bill', b.id)} aria-current={focusedBillId === b.id ? 'true' : undefined}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${focusedBillId === b.id ? 'ring-2 ring-inset ring-[var(--brass)]' : ''}`}>
                      <td className="pl-4">
                        <input type="checkbox" aria-label={`Select bill ${b.number || ''}`.trim()} checked={pickedBills.has(b.id)}
                          onChange={() => setPickedBills(prev => { const next = new Set(prev); if (next.has(b.id)) next.delete(b.id); else next.add(b.id); return next; })} />
                      </td>
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">
                        {b.vendorName || 'Unknown Vendor'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        <InlineEdit value={b.number} display={b.number || b.id.slice(0, 8).toUpperCase()} label={`Number of bill from ${b.vendorName || 'vendor'}`}
                          canEdit={canEditContacts && b.status !== 'void'} onSave={x => updateEntity('bills', b.id, { number: String(x) }, 'Bill number saved')} />
                      </td>
                      <td className="p-4 text-[var(--muted)] dark:text-slate-400">
                        <InlineEdit kind="date" value={b.date?.slice(0, 10)} label={`Date of bill ${b.number || ''}`.trim()} canEdit={canEditContacts && b.status === 'draft'}
                          onSave={x => updateEntity('bills', b.id, { date: String(x) }, 'Date saved')} />
                      </td>
                      <td className="p-4 text-[var(--muted)] dark:text-slate-400">
                        <InlineEdit kind="date" value={b.dueDate?.slice(0, 10)} label={`Due date of bill ${b.number || ''}`.trim()} canEdit={canEditContacts && b.status !== 'paid' && b.status !== 'void'}
                          validate={x => b.date && String(x) < b.date.slice(0, 10) ? 'The due date is before the bill date' : null}
                          onSave={x => updateEntity('bills', b.id, { dueDate: String(x) }, 'Due date saved')} />
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.status === 'paid' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                          {b.status || 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(b.amountCents || 0)}
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewBill(b); }}
                          className="p-1 text-[var(--muted)] hover:text-slate-800 rounded-lg" title="Preview / download PDF" aria-label={`PDF of bill ${b.number || ''}`.trim()}>
                          <Printer className="w-4 h-4" aria-hidden="true" />
                        </button>
                        {b.status !== 'void' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingBill(b); setIsBillModalOpen(true); }}
                            className="p-1 text-[var(--muted)] hover:text-slate-800 rounded-lg"
                            title="Edit bill"
                            aria-label={`Edit bill ${b.number || ''}`.trim()}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {b.status !== 'paid' && b.status !== 'void' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentDocumentId(b.id);
                                setPaymentContactId(b.vendorId || '');
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Pay
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVoidBill(b);
                              }}
                              className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Void
                            </button>
                          </>
                        )}
                        {b.status === 'draft' && <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBill(b);
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                          title="Delete draft"
                          aria-label={`Delete draft bill ${b.number || ''}`.trim()}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>}
                      </td>
                    </tr>
                  );
                })}

                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[var(--muted)] dark:text-slate-400">
                      {loading ? <LoadingState what="bills" /> : searchTerm ? 'No bills match your search.' : 'No bills recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <TagFilter tags={vendorTags} value={vendorTag} onChange={setVendorTag} label="Show vendors with the tag" />
            <ShowArchivedToggle count={archivedVendors} on={showArchivedVendors} onChange={setShowArchivedVendors} noun="vendor" />
            {canEditContacts && (
              <InlineAdd className="px-4 pt-4" label="New vendor name" placeholder="Add a vendor: type a name and press Enter"
                existing={vendors.map(v => v.name)} onAdd={name => addEntity('vendors', { name }, `Vendor "${name}" added`)} />
            )}
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Vendors</caption>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  <th scope="col" className="p-4">Vendor Name</th>
                  <th scope="col" className="p-4">Category</th>
                  <th scope="col" className="p-4">Email</th>
                  <th scope="col" className="p-4">Phone</th>
                  <th scope="col" className="p-4 text-right">Outstanding balance</th>
                  {canEditContacts && <th scope="col" className="p-4 w-10"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredVendors.map(v => (
                  <tr 
                    key={v.id} 
                    onClick={() => setSelectedVendorId(v.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">
                      <InlineEdit value={v.name} label={`Name of ${v.name}`} canEdit={canEditContacts}
                        validate={x => String(x) ? null : 'A vendor needs a name'}
                        onSave={x => updateEntity('vendors', v.id, { name: x }, 'Name saved')} />
                      <ArchivedBadge party={v} />
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      <InlineEdit value={v.category} label={`Category of ${v.name}`} placeholder="Standard" canEdit={canEditContacts}
                        suggestions={vendorCategories}
                        onSave={x => updateEntity('vendors', v.id, { category: x }, 'Category saved')} />
                    </td>
                    <td className="p-4 text-[var(--muted)] dark:text-slate-400">
                      <InlineEdit kind="email" value={v.email} label={`Email of ${v.name}`} placeholder="Add email" canEdit={canEditContacts}
                        onSave={x => updateEntity('vendors', v.id, { email: x }, 'Email saved')} />
                    </td>
                    <td className="p-4 text-[var(--muted)] dark:text-slate-400">
                      <InlineEdit kind="tel" value={v.phone} label={`Phone of ${v.name}`} placeholder="Add phone" canEdit={canEditContacts}
                        onSave={x => updateEntity('vendors', v.id, { phone: x }, 'Phone saved')} />
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(v.balanceCents || 0)}
                    </td>
                    {canEditContacts && <td className="p-4 text-right"><PartyRowActions side="vendor" party={v} /></td>}
                  </tr>
                ))}

                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={canEditContacts ? 6 : 5} className="p-8 text-center text-[var(--muted)] dark:text-slate-400">
                      No vendors listed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill creation modal */}
      {/* mounted per opening, so a new bill never inherits the last edited one */}
      {isBillModalOpen && <BillModal
        key={editingBill?.id || 'new'}
        isOpen={isBillModalOpen}
        onClose={() => { setIsBillModalOpen(false); setEditingBill(undefined); }}
        onSave={handleAddBill}
        vendors={vendors}
        accounts={accounts}
        initialBill={editingBill}
      />}

      {/* Vendor creation modal */}
      <VendorModal 
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSave={handleAddVendor}
      />

      {isPaymentModalOpen && paymentDocumentId && paymentContactId && (
        <ReceivePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          defaultDirection="made"
          defaultDocumentId={paymentDocumentId}
          defaultContactId={paymentContactId}
        />
      )}
      {previewBill && pdfWorkspaceId && (
        <PdfPreviewModal isOpen onClose={() => setPreviewBill(null)} title={`Bill ${previewBill.number || previewBill.id}`}
          documentType="bill" documentId={previewBill.id} workspaceId={pdfWorkspaceId} filename={`bill_${previewBill.number || previewBill.id}.pdf`} />
      )}
    </div>
  );
}
