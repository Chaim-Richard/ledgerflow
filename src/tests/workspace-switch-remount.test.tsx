import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import MainViewSwitcher from '../components/layout/MainViewSwitcher';
import { VIEW_COMPONENTS } from '../config/registry';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';

afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

// #99 for every screen: switching books remounts the open screen, so no list, draft or timer
// from the previous workspace survives into the next one.
test('switching workspace starts the open screen fresh', async () => {
  setComponentWorkspace();
  let made = 0;
  const Probe = () => { const [n] = useState(() => ++made); return <p>screen instance {n}</p>; };
  (VIEW_COMPONENTS as Record<string, React.ComponentType>).__probe = Probe;
  render(<MainViewSwitcher activeTab="__probe" />);
  assert.ok(await screen.findByText('screen instance 1'));
  await act(async () => { useAuthStore.setState({ currentWorkspaceId: 'another-workspace' }); });
  assert.ok(await screen.findByText('screen instance 2'));
  delete (VIEW_COMPONENTS as Record<string, unknown>).__probe;
});
