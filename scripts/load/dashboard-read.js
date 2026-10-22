/**
 * Load test: the dashboard's read (BP-06) — the profit & loss statement from the server, the heaviest
 * read a person makes when they open the app. `src/hooks/useFinancialReporting.ts` calls exactly this
 * URL, so the server does exactly this work.
 *
 *   k6 run -e WORKSPACE_ID=… -e LOAD_EMAIL=… -e LOAD_PASSWORD=… scripts/load/dashboard-read.js
 *
 * The published report reads a workspace's accounts and entries; a 12-month fixture is the realistic
 * size (A-148/A-206). A 401/403 here means the token or the workspace is wrong — fix the test rather
 * than reading the number.
 */
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, WORKSPACE_ID, authHeaders, loadOptions, requireSetup, signIn } from './lib.js';

export const options = loadOptions(20, '60s', {
  // the owner's target: the heaviest report answers in under a second (A-206)
  'http_req_duration{name:profit-and-loss}': ['p(95)<1000'],
  'http_req_failed{name:profit-and-loss}': ['rate<0.01'],
});

export function setup() {
  requireSetup();
  return { token: signIn(http) };
}

export default function (data) {
  const query = new URLSearchParams({ workspaceId: WORKSPACE_ID, startDate: '2025-10-01', endDate: '2026-09-30' });
  const response = http.get(`${BASE_URL}/api/v1/reports/profit-and-loss?${query}`, {
    headers: authHeaders(data.token),
    tags: { name: 'profit-and-loss' },
  });
  check(response, {
    'report answered (200)': r => r.status === 200,
    'the answer is a report': r => Boolean(r.json('data') || r.json('totalIncome') || r.json('revenue') || r.json('income')),
  });
}
