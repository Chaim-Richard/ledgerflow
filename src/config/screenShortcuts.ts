/** Help for the existing local handlers, not new keyboard bindings. */
export interface ScreenShortcutGroup { id: string; title: string; shortcuts: { keys: string; label: string }[] }
export const SCREEN_SHORTCUTS: ScreenShortcutGroup[] = [
  { id: 'transactions', title: 'Transactions — focused grid cells', shortcuts: [
    { keys: '↑ / ↓', label: 'Move to the previous / next transaction' },
    { keys: '← / →', label: 'Move between cells' },
    { keys: 'Tab / Shift + Tab', label: 'Move forward / back between grid cells (native controls keep their normal Tab behavior)' },
    { keys: 'Enter / typing', label: 'Start editing the focused cell' },
    { keys: 'Enter', label: 'Save an inline cell edit' },
    { keys: 'Escape', label: 'Cancel an inline cell edit' },
    { keys: 'Tab', label: 'Accept the first account suggestion while editing an account' },
  ] },
  { id: 'transaction-dialog', title: 'Transaction editor', shortcuts: [
    { keys: 'mod+Enter', label: 'Save the transaction' },
    { keys: 'Escape', label: 'Close the editor' },
  ] },
  { id: 'palette', title: 'Command palette', shortcuts: [
    { keys: 'Enter', label: 'Execute the recognized natural-language instruction' },
    { keys: 'Escape', label: 'Close the command palette' },
  ] },
  { id: 'rules', title: 'Settings — Rules', shortcuts: [{ keys: 'Enter', label: 'Generate a rule from the focused AI rule prompt' }] },
  { id: 'dimensions', title: 'Settings — Dimensions', shortcuts: [{ keys: 'Enter', label: 'Finish editing a node label or aliases (commits on blur)' }] },
  { id: 'saved-views', title: 'Saved views', shortcuts: [{ keys: 'Enter', label: 'Save the named view from the view-name field' }] },
  { id: 'tags', title: 'Tag fields', shortcuts: [
    { keys: 'Enter / comma', label: 'Add the typed tag' },
    { keys: 'Backspace', label: 'Remove the last tag when the tag input is empty' },
  ] },
  { id: 'dialogs', title: 'Dialogs and native controls', shortcuts: [
    { keys: 'Tab / Shift + Tab', label: 'Move through controls; dialog focus stays inside' },
    { keys: 'Escape', label: 'Close the top dialog and return focus' },
    { keys: 'Enter / Space', label: 'Activate a focused button; Space toggles a checkbox' },
  ] },
];
