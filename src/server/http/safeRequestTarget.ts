/**
 * Request targets for telemetry must never contain URL query values, fragments, or link tokens.
 * Use the same sanitizer for both the server request log and the Developer Hub.
 */
export function safeRequestTarget(rawUrl: string): string {
  const path = rawUrl.split(/[?#]/, 1)[0] || '/';
  return path
    .replace(/(\/api\/v1\/invites\/)[^/]+/gi, '$1[redacted]')
    .replace(/(\/api\/v1\/invoices\/public\/)[^/]+/gi, '$1[redacted]')
    .replace(/(\/i\/)pay_[^/]+/gi, '$1[redacted]');
}
