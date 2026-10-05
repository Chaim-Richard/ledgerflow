import { SCREEN_SHORTCUTS } from '../../config/screenShortcuts';
import { shortcutLabel } from '../../config/shortcuts';

export function ScreenShortcutHelp({ mac }: { mac: boolean }) {
  return (<section aria-label="Screen keyboard shortcuts">
                <h3 className="text-sm font-bold mb-4">Screen shortcuts</h3>
                <p className="text-sm text-[var(--muted)] mb-4">These work in their named screen or focused field. Global shortcuts above remain available across screens.</p>
                <div className="space-y-6">
                  {SCREEN_SHORTCUTS.map(group => <section key={group.id} aria-label={group.title}>
                    <h4 className="font-semibold mb-2">{group.title}</h4>
                    <dl className="space-y-2">{group.shortcuts.map(shortcut => <div key={shortcut.label} className="flex flex-wrap justify-between gap-3 border-b border-[var(--line)] py-2">
                      <dt className="text-sm">{shortcut.label}</dt><dd className="font-mono text-sm">{shortcut.keys.includes('mod+') ? shortcutLabel(shortcut.keys, mac) : shortcut.keys}</dd>
                    </div>)}</dl>
                  </section>)}
                </div>
              </section>);
}
