/** Whether a menu tab shows for this user and these switches (registry APP_TABS). */
export function isTabVisible(
  tab: { requiresOwner?: boolean; isAdvanced?: boolean; developerOnly?: boolean },
  opts: { isOwner: boolean; isProMode: boolean; developerMode: boolean },
): boolean {
  return (!tab.requiresOwner || opts.isOwner) && (!tab.isAdvanced || opts.isProMode) && (!tab.developerOnly || opts.developerMode);
}
