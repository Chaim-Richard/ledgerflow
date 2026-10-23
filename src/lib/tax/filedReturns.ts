/** CON-4b: filed tax returns. */

/** The return filed for the whole workspace for exactly this period (one filed for a single registration is not it). */
export function wholeWorkspaceReturn<R extends { startDate: string; endDate: string; registration?: string }>(filed: R[] | null | undefined, startDate: string, endDate: string): R | undefined {
  return filed?.find(r => !r.registration && r.startDate === startDate && r.endDate === endDate);
}
