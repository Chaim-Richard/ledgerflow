import { DEFAULT_WORKSPACE_DIMENSIONS } from './dimensionUtils';
import type { DimensionDefinition } from '../types';
import type { InlineRecordSession } from './inlineRecordFields';
export interface DimensionAxisAdapter {
 session(): InlineRecordSession | null;
 readWorkspace(id: string): Promise<{ id: string; dimensions?: DimensionDefinition[] } | undefined>;
 updateWorkspace(id: string, dimensions: DimensionDefinition[]): Promise<void>;
}
function guard(adapter: DimensionAxisAdapter, session: InlineRecordSession) {
 const current = adapter.session();
 if (!current?.writable || current.uid !== session.uid || current.workspaceId !== session.workspaceId) throw new Error('Workspace or permissions changed. Reopen these settings.');
}
export async function saveDimensionAxisLabel(adapter: DimensionAxisAdapter, axisId: string, before: string, value: string): Promise<void> {
 if (!value.trim() || value.length > 10000) throw new Error('Enter a display name.');
 const session = adapter.session(); if (!session?.writable) throw new Error('Your role cannot edit dimensions.');
 const workspace = await adapter.readWorkspace(session.workspaceId); guard(adapter, session);
 if (!workspace || workspace.id !== session.workspaceId) throw new Error('Save the dimension setup before renaming an axis.');
 const dimensions = workspace.dimensions ?? DEFAULT_WORKSPACE_DIMENSIONS;
 if (!Array.isArray(dimensions) || dimensions.some(d => !d || typeof d.id !== 'string' || typeof d.name !== 'string')) throw new Error('The dimension setup is invalid.');
 const axis = dimensions.find(d => d.id === axisId);
 if (!axis || axis.name !== before) throw new Error('This dimension changed. Reload its current name before saving.');
 await adapter.updateWorkspace(session.workspaceId, dimensions.map(d => d.id === axisId ? { ...d, name: value.trim() } : d)); guard(adapter, session);
}
