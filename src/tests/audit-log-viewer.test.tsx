import { stubFetch } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import AuditLogViewer from '../components/admin/AuditLogViewer';

afterEach(cleanup);

test('audit filters send a request only when applied, and preserve mixed Hebrew values', async () => {
  const urls = stubFetch(200, { logs: [] });
  const view = render(<AuditLogViewer />);
  await waitFor(() => assert.equal(urls.filter(url => url.includes('/admin/audit-logs')).length, 1));
  fireEvent.change(view.getByLabelText('Actor UID'), { target: { value: 'משתמש-42' } });
  view.rerender(<AuditLogViewer />);
  assert.equal(urls.filter(url => url.includes('/admin/audit-logs')).length, 1);
  fireEvent.click(view.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => assert.equal(urls.filter(url => url.includes('/admin/audit-logs')).length, 2));
  assert.equal(new URL(urls.at(-1)!, 'http://localhost').searchParams.get('userId'), 'משתמש-42');
});
