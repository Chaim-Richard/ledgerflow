import { useAuthStore } from '../stores/useAuthStore';

/**
 * A save's reply can arrive after the user opened another workspace (PREV-5). The reply then
 * belongs to the workspace the save was made in: it must not go into the open workspace's lists,
 * and a "saved" message there would read as if it was saved here.
 */
export function workspaceChangedSince(workspaceId: string | null | undefined): boolean {
  return Boolean(workspaceId) && useAuthStore.getState().currentWorkspaceId !== workspaceId;
}

/** "… was saved in Acme Books." — what to say instead of a success message, naming where it went. */
export function savedInOtherWorkspace(what: string, workspaceId: string): string {
  const name = useAuthStore.getState().workspaces.find(w => w.id === workspaceId)?.name;
  return `${what} was saved in ${name ? `“${name}”` : 'the workspace you were in'}, not in this one.`;
}
