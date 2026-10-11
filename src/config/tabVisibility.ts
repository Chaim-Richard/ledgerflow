import { isModuleOn, moduleOfTab, type Modules } from '../lib/modules';

/** Whether a menu tab shows for this user and these switches (registry APP_TABS); a module turned off (BB-07) hides its tabs. */
export function isTabVisible(
  tab: { id?: string; requiresOwner?: boolean; isAdvanced?: boolean; developerOnly?: boolean },
  opts: { isOwner: boolean; isProMode: boolean; developerMode: boolean; modules?: Modules },
): boolean {
  const module = moduleOfTab(tab.id);
  return (!tab.requiresOwner || opts.isOwner) && (!tab.isAdvanced || opts.isProMode) && (!tab.developerOnly || opts.developerMode)
    && (!module || isModuleOn(opts.modules, module));
}
