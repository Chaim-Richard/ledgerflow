/**
 * G-05 (docs/FIRST_TESTERS_GATE.md): whether the build is the invited testers' test environment. True in the built app
 * (what Vercel serves) unless VITE_TEST_ENVIRONMENT is "off", which is set once real books are allowed; false on the
 * development server, which the browser tests and their screenshots run against.
 */
export function testEnvironmentBannerShown(env: { PROD?: boolean; VITE_TEST_ENVIRONMENT?: string } = import.meta.env): boolean {
  return Boolean(env.PROD) && String(env.VITE_TEST_ENVIRONMENT || '').trim().toLowerCase() !== 'off';
}
