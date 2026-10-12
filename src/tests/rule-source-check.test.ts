/**
 * A-59: the source checker's shape. No network here on purpose — the fetcher is a stub, and the
 * test holds: one entry per unique URL, the rules that cite it named, a non-200 answer recorded as an
 * error rather than a pass, a thrown request recorded as unreachable (never as a wrong rule), and a
 * report that never claims a source was verified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { allTaxRules } from '../lib/rules/packs/index';
import {
  ruleSourceIndex, checkRuleSources, sourceReportLines, sourceReportMarkdown, sourceReportSummary,
} from '../lib/rules/sourceCheck';

test('every unique source URL appears once, with the rules that cite it', () => {
  const rules = allTaxRules();
  const index = ruleSourceIndex(rules);
  assert.ok(index.length > 5, `the packs cite several authorities: ${index.length} URLs`);
  assert.equal(new Set(index.map(e => e.url)).size, index.length, 'no URL is listed twice');
  assert.equal(index.reduce((sum, e) => sum + e.ruleCount, 0), rules.length, 'every rule is counted exactly once');
  assert.ok(index.every(e => e.url.startsWith('https://')), 'the packs only cite https sources');
  assert.ok(index.every(e => e.ruleCount >= 1 && e.ruleIds.length === e.ruleCount));
  const texas = index.find(e => e.authorities.some(a => /Texas/i.test(a)));
  assert.ok(texas, 'the Texas Comptroller is among the authorities');
  assert.ok(texas.ruleIds.some(id => id.startsWith('us-sales-tx')));
});

test('a 200 answer is reported as answered; the report never says a rule was verified', async () => {
  const rules = allTaxRules();
  const firstUrl = ruleSourceIndex(rules)[0].url;
  const report = await checkRuleSources(rules, '2026-10-12', {
    urls: [firstUrl],
    fetchImpl: (async () => new Response('ok', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch,
  });
  assert.equal(report.urlCount, 1);
  assert.deepEqual(report.totals, { answered: 1, 'http-error': 0, unreachable: 0, skipped: 0 });
  assert.equal(report.entries[0].result.status, 'answered');
  const summary = sourceReportSummary(report);
  assert.match(summary, /1 of 1 source URLs answered/);
  assert.match(summary, /not that the row still matches/);
  const markdown = sourceReportMarkdown(report);
  assert.match(markdown, /not\s+a review of the rule/);
  assert.doesNotMatch(markdown, /verified/i);
});

test('a 404 is an error in the report, and a throwing request is unreachable — neither is a pass', async () => {
  const rules = allTaxRules();
  const [first, second] = ruleSourceIndex(rules).map(e => e.url);
  const fetchImpl = (async (input: RequestInfo | URL) => {
    if (String(input) === first) return new Response('missing', { status: 404 });
    throw new Error('getaddrinfo ENOTFOUND');
  }) as typeof fetch;
  const report = await checkRuleSources(rules, '2026-10-12', { urls: [first, second], fetchImpl });
  assert.deepEqual(report.totals, { answered: 0, 'http-error': 1, unreachable: 1, skipped: 0 });
  const lines = sourceReportLines(report);
  assert.match(lines[0], /^unreachable/, 'failures come first in the report');
  assert.match(lines[1], /^http-error \(404\)/);
  assert.match(lines.join('\n'), /answered 404/);
  assert.match(sourceReportSummary(report), /1 answered with an error status, 1 could not be reached/);
});

test('a dry run makes no request and says so', async () => {
  const report = await checkRuleSources(allTaxRules(), '2026-10-12', { dryRun: true, urls: [ruleSourceIndex(allTaxRules())[0].url] });
  assert.deepEqual(report.totals, { answered: 0, 'http-error': 0, unreachable: 0, skipped: 1 });
  assert.match(report.entries[0].result.detail, /dry run/);
  assert.match(sourceReportMarkdown(report), /not checked/);
});

test('a redirect is recorded with the final URL, not hidden', async () => {
  const rules = allTaxRules();
  const url = ruleSourceIndex(rules)[0].url;
  const report = await checkRuleSources(rules, '2026-10-12', {
    urls: [url],
    fetchImpl: (async () => {
      const response = new Response('', { status: 200 });
      Object.defineProperty(response, 'url', { value: 'https://example.gov/moved' });
      return response;
    }) as typeof fetch,
  });
  assert.equal(report.entries[0].result.finalUrl, 'https://example.gov/moved');
  assert.match(report.entries[0].result.detail, /redirects to/);
});
