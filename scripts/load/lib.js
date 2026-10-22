/**
 * Shared settings for the load tests (k6). Nothing here is imported by the app.
 *
 * Every script reads the same environment and refuses to start without the two things it cannot
 * guess: the app's address and the workspace to read.
 *
 *   BASE_URL   http://localhost:3000            the app (npm run dev, or a staging deployment)
 *   SUPABASE_URL + SUPABASE_ANON_KEY            sign-in (the app's own auth provider)
 *   LOAD_EMAIL + LOAD_PASSWORD                  a real test account, owner of the workspace
 *   WORKSPACE_ID                                the workspace the tests read and post in
 *   WORKSPACE_ACCOUNT_AR / _REVENUE / _TAX     account ids the invoice fixture uses (optional:
 *                                              defaults to the workspace's default mappings)
 */

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SUPABASE_URL = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
export const WORKSPACE_ID = __ENV.WORKSPACE_ID || '';
export const EMAIL = __ENV.LOAD_EMAIL || '';
export const PASSWORD = __ENV.LOAD_PASSWORD || '';

/** One iteration of each scenario is a real request, so a missing setting is a wrong test, not a slow one. */
export function required(name, value) {
  if (!value) throw new Error(`${name} is not set — see scripts/load/README.md`);
  return value;
}

export function requireSetup() {
  required('SUPABASE_URL', SUPABASE_URL);
  required('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
  required('WORKSPACE_ID', WORKSPACE_ID);
  required('LOAD_EMAIL', EMAIL);
  required('LOAD_PASSWORD', PASSWORD);
}

/** Signs in once per virtual user and keeps the access token (setup() and the default function share it). */
export function signIn(http) {
  const response = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, tags: { name: 'sign-in' } },
  );
  if (response.status !== 200) throw new Error(`sign-in failed: ${response.status} ${response.body}`);
  const token = response.json('access_token');
  if (!token) throw new Error('sign-in answered without an access token');
  return token;
}

export const authHeaders = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

/** Common k6 options. The thresholds are the point of the test: they fail the run, not just print. */
export function loadOptions(vus, duration, thresholds) {
  return {
    vus,
    duration,
    thresholds: {
      http_req_failed: ['rate<0.01'],
      ...thresholds,
    },
  };
}
