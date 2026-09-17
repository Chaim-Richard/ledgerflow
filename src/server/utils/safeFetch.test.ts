import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateSafeUrl, isPrivateOrReservedIPv4, isPrivateOrReservedIPv6 } from './safeFetch';

describe('SSRF Guard & safeFetch Security Suite', () => {
  test('correctly classifies private IPv4 ranges', () => {
    assert.strictEqual(isPrivateOrReservedIPv4('127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIPv4('10.0.0.5'), true);
    assert.strictEqual(isPrivateOrReservedIPv4('192.168.1.1'), true);
    assert.strictEqual(isPrivateOrReservedIPv4('172.16.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIPv4('172.31.255.255'), true);
    assert.strictEqual(isPrivateOrReservedIPv4('169.254.169.254'), true); // Cloud Metadata
    assert.strictEqual(isPrivateOrReservedIPv4('0.0.0.0'), true);
    assert.strictEqual(isPrivateOrReservedIPv4('255.255.255.255'), true);

    // Public IPs should pass
    assert.strictEqual(isPrivateOrReservedIPv4('8.8.8.8'), false);
    assert.strictEqual(isPrivateOrReservedIPv4('1.1.1.1'), false);
    assert.strictEqual(isPrivateOrReservedIPv4('142.250.190.46'), false);
  });

  test('correctly classifies private IPv6 ranges', () => {
    assert.strictEqual(isPrivateOrReservedIPv6('::1'), true);
    assert.strictEqual(isPrivateOrReservedIPv6('fe80::1'), true);
    assert.strictEqual(isPrivateOrReservedIPv6('fc00::1'), true);
    assert.strictEqual(isPrivateOrReservedIPv6('::ffff:127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIPv6('::ffff:169.254.169.254'), true);

    // Public IPv6
    assert.strictEqual(isPrivateOrReservedIPv6('2607:f8b0:4005:805::200e'), false);
  });

  test('validateSafeUrl blocks localhost and cloud metadata URLs', async () => {
    await assert.rejects(
      async () => validateSafeUrl('http://127.0.0.1:8080/admin'),
      /SSRF Prevention/
    );

    await assert.rejects(
      async () => validateSafeUrl('http://169.254.169.254/computeMetadata/v1/'),
      /SSRF Prevention/
    );

    await assert.rejects(
      async () => validateSafeUrl('http://localhost:3000/api/secret'),
      /SSRF Prevention/
    );

    await assert.rejects(
      async () => validateSafeUrl('file:///etc/passwd'),
      /Forbidden protocol/
    );
  });

  test('validateSafeUrl enforces allowed hostnames when provided', async () => {
    await assert.rejects(
      async () => validateSafeUrl('https://evil.com/payload', ['api.stripe.com', 'api.github.com']),
      /not in the allowed destinations list/
    );
  });
});
