import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, within } from '@testing-library/react';
import { ScreenShortcutHelp } from '../components/layout/ScreenShortcutHelp';
import { SCREEN_SHORTCUTS } from '../config/screenShortcuts';

test('the shortcut overlay explains existing screen and focused-field handlers', () => {
  const view = render(<ScreenShortcutHelp mac={false} />);
  try {
    for (const group of SCREEN_SHORTCUTS) {
      const section = view.getByRole('region', { name: group.title });
      for (const shortcut of group.shortcuts) assert.ok(within(section).getByText(shortcut.label));
    }
    assert.ok(view.getByText(/Save the transaction/));
    assert.ok(within(view.getByRole('region', { name: 'Transaction editor' })).getByText(/Ctrl.*Enter|⌘.*Enter/));
    assert.ok(view.getByText(/native controls keep their normal Tab/));
  } finally { cleanup(); }
});
