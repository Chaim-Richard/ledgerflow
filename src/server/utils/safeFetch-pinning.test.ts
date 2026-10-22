/**
 * AUD-11: the address safeFetch checks is the address it connects to. DNS is asked once; the
 * socket's lookup answers with that checked address, so a DNS change between check and connect
 * (rebinding) cannot redirect the connection. No real DNS or internet is used.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  safeFetch, resolveSafeTarget, requestPinned, pinnedLookup, pinnedRequestOptions,
  type HostResolver, type SafeTarget,
} from './safeFetch';

/** A resolver that answers from a script and counts how often it was asked. */
function scriptedResolver(...answers: string[][]) {
  const calls: string[] = [];
  const resolver: HostResolver = async hostname => {
    calls.push(hostname);
    const next = answers[Math.min(calls.length - 1, answers.length - 1)];
    return next.map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
  };
  return { resolver, calls };
}

// A local server standing in for an internal service an attacker would rebind to.
const hits: Array<{ host?: string; url?: string; method?: string; body: string }> = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    hits.push({ host: req.headers.host, url: req.url, method: req.method, body });
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
});
const ready = new Promise<number>(resolve => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
after(() => new Promise<void>(resolve => server.close(() => resolve())));

describe('safeFetch pins the checked address (AUD-11)', () => {
  test('DNS answering public at check time and private afterwards: DNS is asked once and the private address is never reached', async () => {
    const port = await ready;
    hits.length = 0;
    // 203.0.113.10 (TEST-NET-3) is public to the guard but routes nowhere; the second answer is the local server.
    const { resolver, calls } = scriptedResolver(['203.0.113.10'], ['127.0.0.1']);
    await assert.rejects(safeFetch(`http://rebind.example.test:${port}/internal`, { resolver, timeoutMs: 400 }));
    assert.deepEqual(calls, ['rebind.example.test'], 'resolved exactly once: no second lookup at connect time');
    assert.equal(hits.length, 0, 'the connection did not follow the changed DNS answer to the private address');
  });

  test('the checked target is the first resolved address, and every answer must be public', async () => {
    const ok = await resolveSafeTarget('https://api.example.test/v1', undefined, scriptedResolver(['203.0.113.10', '198.51.100.7']).resolver);
    assert.equal(ok.address, '203.0.113.10');
    assert.equal(ok.family, 4);
    await assert.rejects(
      resolveSafeTarget('https://api.example.test/v1', undefined, scriptedResolver(['203.0.113.10', '10.0.0.5']).resolver),
      /SSRF Prevention: Host api\.example\.test resolves to forbidden IP 10\.0\.0\.5/,
    );
  });

  test('a host resolving to a private, loopback or metadata address is refused before any connection', async () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '::1', 'fd00::1', '::ffff:192.168.0.1']) {
      const { resolver } = scriptedResolver([address]);
      await assert.rejects(safeFetch('https://internal.example.test/', { resolver }), /SSRF Prevention/, address);
    }
    await assert.rejects(safeFetch('http://[::1]:8080/'), /SSRF Prevention/);
  });

  test('the pinned connection goes to the checked address and keeps the original hostname in the Host header', async () => {
    const port = await ready;
    hits.length = 0;
    // requestPinned does no validation of its own; here it is pointed at the local server directly
    // to prove the socket uses the pinned address (the hostname itself does not resolve anywhere).
    const target: SafeTarget = { url: new URL(`http://api.unresolvable.invalid:${port}/v1/send?x=1`), address: '127.0.0.1', family: 4 };
    const res = await requestPinned(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, path: '/v1/send?x=1' });
    assert.deepEqual(hits, [{ host: `api.unresolvable.invalid:${port}`, url: '/v1/send?x=1', method: 'POST', body: '{"a":1}' }]);
  });

  test('redirects are refused rather than followed to an unchecked address', async () => {
    const port = await ready;
    hits.length = 0;
    const target: SafeTarget = { url: new URL(`http://api.unresolvable.invalid:${port}/redirect`), address: '127.0.0.1', family: 4 };
    await assert.rejects(requestPinned(target), /redirect to http:\/\/169\.254\.169\.254\/latest\/meta-data\/ refused/);
    assert.equal(hits.length, 1, 'only the first hop was requested');
  });

  test('pinnedLookup answers only for the checked hostname, with the checked address, in both callback forms', () => {
    const target: SafeTarget = { url: new URL('https://api.example.test/'), address: '203.0.113.10', family: 4 };
    const lookup = pinnedLookup(target);
    lookup('api.example.test', {}, (err, address, family) => {
      assert.equal(err, null);
      assert.equal(address, '203.0.113.10');
      assert.equal(family, 4);
    });
    lookup('API.example.test', { all: true }, (err, addresses) => {
      assert.equal(err, null);
      assert.deepEqual(addresses, [{ address: '203.0.113.10', family: 4 }]);
    });
    lookup('other.example.test', {}, err => assert.match(String(err?.message), /unexpected lookup/));
  });

  test('HTTPS keeps the original hostname for SNI and certificate checks', () => {
    const target: SafeTarget = { url: new URL('https://api.resend.com/emails'), address: '203.0.113.10', family: 4 };
    const options = pinnedRequestOptions(target, 'POST', {});
    assert.equal(options.hostname, 'api.resend.com');
    assert.equal(options.servername, 'api.resend.com');
    assert.equal(options.port, 443);
    assert.equal(options.path, '/emails');
    assert.equal(options.agent, false, 'no shared keep-alive socket can bypass the pin');
    assert.notEqual((options as { rejectUnauthorized?: boolean }).rejectUnauthorized, false);
  });
});
