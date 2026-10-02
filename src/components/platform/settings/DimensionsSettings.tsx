import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  Archive, 
  Check, 
  Database, 
  Layers, 
  RefreshCw, 
  ShieldCheck, 
  Info,
  ChevronRight,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { doc, updateDoc, writeBatch } from '../../../lib/db/firestore';
import { db } from '../../../firebase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { 
  DimensionDefinition, 
  DimensionNode 
} from '../../../types';
import { 
  DEFAULT_WORKSPACE_DIMENSIONS, 
  suggestNextDimensionNodeId, 
  migrateWorkspaceDimensionNodes,
  backfillDimensionNodesFromTransactions
} from '../../../lib/dimensionUtils';
import AsyncButton from '../../ui/AsyncButton';
import { Labelled } from '../../ui/Labelled';

function EditableNodeDescription({
  initialValue,
  onCommit
}: {
  initialValue: string;
  onCommit: (newVal: string) => void;
}) {
  const [val, setVal] = useState(initialValue);
  const [prevInitial, setPrevInitial] = useState(initialValue);

  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setVal(initialValue);
  }

  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => {
        const trimmed = val.trim();
        if (trimmed && trimmed !== initialValue.trim()) {
          onCommit(trimmed);
        } else if (!trimmed) {
          setVal(initialValue);
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full bg-[var(--surface)] border border-[var(--line)] focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-[var(--text)] outline-none font-medium"
    />
  );
}

function EditableNodeAliases({
  initialValue,
  onCommit
}: {
  initialValue: string;
  onCommit: (newVal: string) => void;
}) {
  const [val, setVal] = useState(initialValue);
  const [prevInitial, setPrevInitial] = useState(initialValue);

  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setVal(initialValue);
  }

  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => {
        if (val !== initialValue) {
          onCommit(val);
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="e.g. Alias 1, Alias 2"
      className="w-full bg-[var(--surface)] border border-[var(--line)] focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-400 outline-none"
    />
  );
}

export default function DimensionsSettings() {
  const currentWorkspace = useAuthStore(s => s.getCurrentWorkspace());
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const transactions = useLedgerStore(s => s.transactions);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  const storeDimensionNodes = useLedgerStore(s => s.dimensionNodes);
  const storeSetDimensionNodes = useLedgerStore(s => s.setDimensionNodes);

  const [dimensions, setDimensions] = useState<DimensionDefinition[]>(() => {
    return currentWorkspace?.dimensions || DEFAULT_WORKSPACE_DIMENSIONS;
  });

  const [dimensionNodes, setDimensionNodes] = useState<DimensionNode[]>(storeDimensionNodes);

  useEffect(() => {
    if (storeDimensionNodes && storeDimensionNodes.length > 0) {
      setDimensionNodes(storeDimensionNodes);
    }
  }, [storeDimensionNodes]);

  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Form state for adding new axis
  const [newAxisId, setNewAxisId] = useState('');
  const [newAxisName, setNewAxisName] = useState('');
  const [showAddAxis, setShowAddAxis] = useState(false);

  // Form state for adding node per axis
  const [newNodeInputs, setNewNodeInputs] = useState<Record<string, { description: string; aliases: string }>>({});

  const handleNodeInputChange = (dimId: string, field: 'description' | 'aliases', value: string) => {
    setNewNodeInputs(prev => ({
      ...prev,
      [dimId]: {
        ...(prev[dimId] || { description: '', aliases: '' }),
        [field]: value
      }
    }));
  };

  const handleAddNode = (dimId: string) => {
    const input = newNodeInputs[dimId];
    if (!input || !input.description.trim()) {
      toast.error('Please enter a description for the new label node');
      return;
    }

    const nextId = suggestNextDimensionNodeId(dimId, dimensionNodes);
    const aliasesArray = input.aliases
      ? input.aliases.split(',').map(a => a.trim()).filter(Boolean)
      : [];

    const newNode: DimensionNode = {
      id: nextId,
      dimensionId: dimId,
      description: input.description.trim(),
      aliases: aliasesArray,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setDimensionNodes(prev => [...prev, newNode]);
    setNewNodeInputs(prev => ({ ...prev, [dimId]: { description: '', aliases: '' } }));
    toast.success(`Created label node ${nextId} ("${newNode.description}")`);
  };

  const handleUpdateNodeDescription = (nodeId: string, dimId: string, newDescription: string) => {
    setDimensionNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.dimensionId === dimId) {
        const prevDesc = n.description?.trim();
        const aliases = [...(n.aliases || [])];
        if (prevDesc && prevDesc !== newDescription.trim() && !aliases.some(a => a.toLowerCase() === prevDesc.toLowerCase())) {
          aliases.push(prevDesc);
        }
        return { ...n, description: newDescription, aliases };
      }
      return n;
    }));
  };

  const handleUpdateNodeAliases = (nodeId: string, dimId: string, aliasesStr: string) => {
    const aliasesArray = aliasesStr.split(',').map(a => a.trim()).filter(Boolean);
    setDimensionNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.dimensionId === dimId) {
        return { ...n, aliases: aliasesArray };
      }
      return n;
    }));
  };

  const handleToggleArchiveNode = (nodeId: string, dimId: string) => {
    setDimensionNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.dimensionId === dimId) {
        const nextStatus = n.status === 'archived' ? 'active' : 'archived';
        return { ...n, status: nextStatus };
      }
      return n;
    }));
  };

  const handleUpdateAxisName = (axisId: string, newName: string) => {
    setDimensions(prev => prev.map(d => {
      if (d.id === axisId) {
        return { ...d, name: newName };
      }
      return d;
    }));
  };

  const handleAddAxis = () => {
    if (!newAxisId.trim() || !newAxisName.trim()) {
      toast.error('Axis key and display name are required');
      return;
    }

    const cleanId = newAxisId.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    if (dimensions.some(d => d.id === cleanId)) {
      toast.error(`Dimension axis with ID "${cleanId}" already exists`);
      return;
    }

    const newDim: DimensionDefinition = {
      id: cleanId,
      name: newAxisName.trim(),
      sortOrder: dimensions.length
    };

    setDimensions(prev => [...prev, newDim]);
    setNewAxisId('');
    setNewAxisName('');
    setShowAddAxis(false);
    toast.success(`Added dimension axis "${newDim.name}" (${newDim.id})`);
  };

  const handleSaveChanges = async () => {
    if (!currentWorkspaceId) return;
    setIsSaving(true);
    try {
      if (db) {
        const wsRef = doc(db, 'workspaces', currentWorkspaceId);
        await updateDoc(wsRef, {
          dimensions
        });

        // Write individual nodes in batch
        const batch = writeBatch(db);
        dimensionNodes.forEach(node => {
          const docId = `${currentWorkspaceId}_${node.dimensionId}_${node.id}`;
          const nodeRef = doc(db, 'dimensionNodes', docId);
          batch.set(nodeRef, {
            ...node,
            workspaceId: currentWorkspaceId
          });
        });
        await batch.commit();
      }

      // Update store slice
      storeSetDimensionNodes(dimensionNodes);

      // Update local workspace store
      const allWorkspaces = useAuthStore.getState().workspaces;
      const updated = allWorkspaces.map(w => {
        if (w.id === currentWorkspaceId) {
          return { ...w, dimensions };
        }
        return w;
      });
      setWorkspaces(updated);

      toast.success('Dimension axes & label nodes saved successfully');
    } catch (err: any) {
      console.error('Failed to save dimension settings:', err);
      toast.error(`Save failed: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunMigration = async () => {
    if (!currentWorkspaceId) return;
    setIsMigrating(true);
    try {
      const { updatedTransactions, updatedNodes, migrationCount } = migrateWorkspaceDimensionNodes(
        transactions,
        dimensionNodes,
        dimensions
      );

      if (migrationCount === 0 && updatedNodes.length === dimensionNodes.length) {
        toast.info('All transaction dimension values are already stored as stable node IDs.');
        setIsMigrating(false);
        return;
      }

      setDimensionNodes(updatedNodes);
      setTransactions(updatedTransactions);

      // Persist nodes
      if (db) {
        const batch = writeBatch(db);
        updatedNodes.forEach(node => {
          const docId = `${currentWorkspaceId}_${node.dimensionId}_${node.id}`;
          const nodeRef = doc(db, 'dimensionNodes', docId);
          batch.set(nodeRef, {
            ...node,
            workspaceId: currentWorkspaceId
          });
        });
        await batch.commit();

        // Batch update modified transactions in chunks of 450
        const chunkSize = 450;
        for (let i = 0; i < updatedTransactions.length; i += chunkSize) {
          const chunk = updatedTransactions.slice(i, i + chunkSize);
          const tBatch = writeBatch(db);
          let batchHasWrites = false;
          chunk.forEach(tx => {
            if (tx.id) {
              const txRef = doc(db, 'transactions', tx.id);
              tBatch.update(txRef, { lines: tx.lines });
              batchHasWrites = true;
            }
          });
          if (batchHasWrites) {
            await tBatch.commit();
          }
        }
      }

      // Update store slice
      storeSetDimensionNodes(updatedNodes);

      // Update local workspace store
      const allWorkspaces = useAuthStore.getState().workspaces;
      const updated = allWorkspaces.map(w => {
        if (w.id === currentWorkspaceId) {
          return { ...w, dimensions };
        }
        return w;
      });
      setWorkspaces(updated);

      toast.success(`Migration complete! Converted ${migrationCount} free-text labels to stable node IDs.`);
    } catch (err: any) {
      console.error('Migration failed:', err);
      toast.error(`Migration failed: ${err.message || err}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRunBackfillOnly = async () => {
    if (!currentWorkspaceId) return;
    setIsMigrating(true);
    try {
      const { allNodes, createdCount } = backfillDimensionNodesFromTransactions(
        transactions,
        dimensionNodes,
        dimensions
      );

      if (createdCount === 0) {
        toast.info('All historical free-text paths are already backed by registered nodes.');
        setIsMigrating(false);
        return;
      }

      setDimensionNodes(allNodes);

      if (db) {
        const batch = writeBatch(db);
        allNodes.forEach(node => {
          const docId = `${currentWorkspaceId}_${node.dimensionId}_${node.id}`;
          const nodeRef = doc(db, 'dimensionNodes', docId);
          batch.set(nodeRef, {
            ...node,
            workspaceId: currentWorkspaceId
          });
        });
        await batch.commit();
      }

      // Update store slice
      storeSetDimensionNodes(allNodes);

      const allWorkspaces = useAuthStore.getState().workspaces;
      const updated = allWorkspaces.map(w => {
        if (w.id === currentWorkspaceId) {
          return { ...w, dimensions };
        }
        return w;
      });
      setWorkspaces(updated);

      toast.success(`One-time backfill complete: minted ${createdCount} new nodes from transaction paths.`);
    } catch (err: any) {
      console.error('Backfill failed:', err);
      toast.error(`Backfill failed: ${err.message || err}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Overview Banner */}
      <div className="p-6 md:p-8 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
            <Layers size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text)] tracking-tight">Dimensions & Label Node Registry</h3>
            <p className="text-xs text-slate-500 font-medium">
              Stable identity map for dimensional accounting. Renaming a label node description updates all historical reporting without splitting buckets.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
              <Lock size={12} className="text-indigo-500" /> Immutable Axis ID
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Axis keys (e.g., <code className="text-indigo-600 font-bold">category</code>, <code className="text-indigo-600 font-bold">project</code>) cannot be renamed to prevent orphaned querying history.
            </p>
          </div>

          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
              <ShieldCheck size={12} className="text-emerald-500" /> Stable Node Identity
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Transactions store short stable codes (e.g. <code className="text-emerald-600 font-bold">P1</code>). Changing the description instantly updates all past transactions.
            </p>
          </div>

          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
              <Archive size={12} className="text-amber-500" /> Append-Only Archiving
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Nodes are archived rather than deleted, keeping existing transaction lines valid while hiding old categories from new entries.
            </p>
          </div>
        </div>
      </div>

      {/* Migration Card */}
      <div className="p-6 bg-gradient-to-r from-indigo-950/20 via-purple-950/10 to-transparent border border-indigo-500/20 rounded-[28px] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <Database size={12} /> Auto-Migration Engine
          </div>
          <h4 className="text-base font-bold text-[var(--text)]">Migrate Free-Text Labels to Stable Nodes</h4>
          <p className="text-xs text-slate-400 font-medium">
            Scans all existing transaction lines, automatically mints node records for free-text dimension labels, and rewrites lines to store stable node IDs.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <AsyncButton
            type="button"
            loading={isMigrating}
            onClick={handleRunBackfillOnly}
            className="px-4 py-3 bg-[var(--surface)] border border-indigo-500/40 hover:bg-indigo-500/10 text-indigo-300 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Database size={14} />
            One-Time Node Backfill
          </AsyncButton>

          <AsyncButton
            type="button"
            loading={isMigrating}
            onClick={handleRunMigration}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={14} className={isMigrating ? "animate-spin" : ""} />
            Run Full Migration Sweep
          </AsyncButton>
        </div>
      </div>

      {/* Dimension Axes & Nodes */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text)]">Configured Dimensions ({dimensions.length})</h3>
          <button
            type="button"
            onClick={() => setShowAddAxis(!showAddAxis)}
            className="px-4 py-2 bg-[var(--surface)] border border-[var(--line)] hover:border-indigo-500/50 text-[var(--text)] text-xs font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Plus size={14} /> Add Dimension Axis
          </button>
        </div>

        {showAddAxis && (
          <div className="p-6 bg-[var(--surface)] border border-indigo-500/30 rounded-2xl space-y-4 animate-fadeIn">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Add New Dimension Axis</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Labelled labelClassName="text-[10px] font-bold text-slate-400 uppercase" label="Axis Key / ID (Immutable)">
                  <input
                    type="text"
                    value={newAxisId}
                    onChange={e => setNewAxisId(e.target.value)}
                    placeholder="e.g. cost_center or region"
                    className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-indigo-500 font-mono"
                  />
                </Labelled>
              </div>
              <div className="space-y-1">
                <Labelled labelClassName="text-[10px] font-bold text-slate-400 uppercase" label="Display Name">
                  <input
                    type="text"
                    value={newAxisName}
                    onChange={e => setNewAxisName(e.target.value)}
                    placeholder="e.g. Cost Center or Region"
                    className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-indigo-500"
                  />
                </Labelled>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAxis(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAxis}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
              >
                Create Axis
              </button>
            </div>
          </div>
        )}

        {dimensions.map(dim => {
          const axisNodes = dimensionNodes.filter(n => n.dimensionId === dim.id);
          const nextSuggestedId = suggestNextDimensionNodeId(dim.id, dimensionNodes);
          const nodeInput = newNodeInputs[dim.id] || { description: '', aliases: '' };

          return (
            <div key={dim.id} className="p-6 bg-[var(--surface)] border border-[var(--line)] rounded-3xl space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={dim.name}
                      onChange={e => handleUpdateAxisName(dim.id, e.target.value)}
                      className="text-base font-black text-[var(--text)] bg-transparent border-b border-transparent hover:border-slate-400 focus:border-indigo-500 outline-none transition-all px-1"
                    />
                    <span className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-[10px] rounded-lg font-bold">
                      {dim.id}
                    </span>
                    {dim.systemDefault && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase rounded-full">
                        System Default
                      </span>
                    )}
                    {dim.isWorld && (
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase rounded-full">
                        World Entity
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Axis Key ID: <span className="font-mono text-slate-400">{dim.id}</span> (Immutable) — {axisNodes.length} registered label node{axisNodes.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {/* Node List Table */}
              {axisNodes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--line)] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2 px-3 w-24">Node ID</th>
                        <th className="py-2 px-3">Display Description</th>
                        <th className="py-2 px-3">Aliases (CSV)</th>
                        <th className="py-2 px-3 w-28">Status</th>
                        <th className="py-2 px-3 w-28 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {axisNodes.map(node => (
                        <tr key={node.id} className={node.status === 'archived' ? 'opacity-50 bg-slate-900/30' : ''}>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-400 text-xs">
                            {node.id}
                          </td>
                          <td className="py-2.5 px-3">
                            <EditableNodeDescription
                              initialValue={node.description}
                              onCommit={newVal => handleUpdateNodeDescription(node.id, dim.id, newVal)}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <EditableNodeAliases
                              initialValue={(node.aliases || []).join(', ')}
                              onCommit={newVal => handleUpdateNodeAliases(node.id, dim.id, newVal)}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            {node.status === 'archived' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded-full">
                                <Archive size={10} /> Archived
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full">
                                <Check size={10} /> Active
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleArchiveNode(node.id, dim.id)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                node.status === 'archived'
                                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                              }`}
                            >
                              {node.status === 'archived' ? 'Unarchive' : 'Archive'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center border border-dashed border-[var(--line)] rounded-2xl text-xs text-slate-500">
                  No registered label nodes for <span className="font-bold text-slate-400">{dim.name}</span> yet. Add one below.
                </div>
              )}

              {/* Add New Node Row */}
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                  <span>Register New Label Node</span>
                  <span className="font-mono text-slate-500">Next ID: <strong className="text-indigo-400">{nextSuggestedId}</strong></span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-2 font-mono text-xs font-bold text-indigo-400 px-3 py-2 bg-slate-900 border border-[var(--line)] rounded-xl text-center">
                    {nextSuggestedId}
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={nodeInput.description}
                      onChange={e => handleNodeInputChange(dim.id, 'description', e.target.value)}
                      placeholder="Display Description (e.g. Food & Beverage)"
                      className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={nodeInput.aliases}
                      onChange={e => handleNodeInputChange(dim.id, 'aliases', e.target.value)}
                      placeholder="Aliases (comma-separated)"
                      className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => handleAddNode(dim.id)}
                      className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} /> Add Node
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button Bar */}
      <div className="flex justify-end pt-6 border-t border-[var(--line)]">
        <AsyncButton
          type="button"
          loading={isSaving}
          onClick={handleSaveChanges}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2"
        >
          <Check size={16} /> Save Dimension Registry
        </AsyncButton>
      </div>
    </div>
  );
}
