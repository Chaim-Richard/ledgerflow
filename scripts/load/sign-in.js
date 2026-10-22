/**
 * Load test: signing in (BP-06). Measures the auth provider's answer plus the network to it, which is
 * what a person waits for before the app opens. It is not the app server's own work — that is
 * dashboard-read.js and post-invoice.js.
 *
 *   k6 run -e SUPABASE_URL=… -e SUPABASE_ANON_KEY=… -e LOAD_EMAIL=… -e LOAD_PASSWORD=… scripts/load/sign-in.js
 *
 * Run it with a small number of virtual users: an auth provider rate-limits password sign-ins, and a
 * 429 here is the test being refused, not the product failing.
 */
import http from 'k6/http';
import { check } from 'k6';
import { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL, PASSWORD, loadOptions, requireSetup } from './lib.js';

export const options = loadOptions(5, '30s', {
  // a person notices a second; the provider is expected to answer far faster than that
  'http_req_duration{name:sign-in}': ['p(95)<1000'],
  checks: ['rate>0.99'],
});

export function setup() {
  requireSetup();
}

export default function () {
  const response = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, tags: { name: 'sign-in' } },
  );
  check(response, {
    'signed in (200)': r => r.status === 200,
    'an access token came back': r => Boolean(r.json('access_token')),
  });
}
