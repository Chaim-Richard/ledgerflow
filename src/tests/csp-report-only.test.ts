/**
 * Tests for S-23: Content-Security-Policy tightened (no unsafe-inline where possible); report-only first
 */

import { describe, it, expect, beforeEach } from 'node:test';
import {
  generateCspHeader,
  generateNonce,
  generateReportOnlySecurityHeaders,
  cspReportOnlyMiddleware,
  cspEnforcementMiddleware,
  createCspViolationEndpoint,
  validateCspConfiguration,
  generateCspMigrationReport,
  defaultCspReportOnlyConfig
} from '../server/middleware/cspReportOnly';

/**
 * Mock request/response objects
 */
function createMockRequest(): any {
  return {
    method: 'GET',
    path: '/',
    headers: { 'user-agent': 'Test' },
    ip: '192.168.1.1'
  };
}

function createMockResponse(): any {
  const res: any = {
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  return res;
}

describe('CSP Report-Only Mode (S-23)', () => {
  describe('generateNonce', () => {
    it('should generate a base64-encoded nonce', () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces each time', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate nonces of consistent length', () => {
      const nonces = Array.from({ length: 10 }, () => generateNonce());
      const lengths = nonces.map(n => n.length);
      expect(new Set(lengths).size).toBe(1); // All same length
    });
  });

  describe('generateCspHeader', () => {
    it('should generate a valid CSP string', () => {
      const csp = generateCspHeader({});
      expect(typeof csp).toBe('string');
      expect(csp.length).toBeGreaterThan(0);
    });

    it('should include default-src self', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain("default-src 'self'");
    });

    it('should include script-src with nonce when useNonces is true', () => {
      const csp = generateCspHeader({ useNonces: true });
      expect(csp).toContain("script-src 'self' 'nonce-");
    });

    it('should include script-src with unsafe-inline when useNonces is false', () => {
      const csp = generateCspHeader({ useNonces: false });
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    });

    it('should include style-src with nonce when useNonces is true', () => {
      const csp = generateCspHeader({ useNonces: true });
      expect(csp).toContain("style-src 'self' 'nonce-");
    });

    it('should include style-src with unsafe-inline when useNonces is false', () => {
      const csp = generateCspHeader({ useNonces: false });
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should include Plaid domain in script-src', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain('https://cdn.plaid.com');
    });

    it('should include Google Fonts in style-src', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain('https://fonts.googleapis.com');
    });

    it('should include Google Fonts static in font-src', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain('https://fonts.gstatic.com');
    });

    it('should include Stripe in frame-src', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain('https://*.stripe.com');
    });

    it('should include Plaid in frame-src', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain('https://cdn.plaid.com');
    });

    it('should include object-src none', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain("object-src 'none'");
    });

    it('should include base-uri self', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain("base-uri 'self'");
    });

    it('should include form-action self', () => {
      const csp = generateCspHeader({});
      expect(csp).toContain("form-action 'self'");
    });

    it('should add report-uri when specified', () => {
      const csp = generateCspHeader({ reportUri: 'https://example.com/csp-report' });
      expect(csp).toContain('report-uri https://example.com/csp-report');
    });

    it('should add additional script domains', () => {
      const csp = generateCspHeader({
        additionalDomains: {
          script: ['https://example.com']
        }
      });
      expect(csp).toContain('https://example.com');
    });

    it('should add additional style domains', () => {
      const csp = generateCspHeader({
        additionalDomains: {
          style: ['https://example.com']
        }
      });
      expect(csp).toContain('https://example.com');
    });

    it('should add additional connect domains', () => {
      const csp = generateCspHeader({
        additionalDomains: {
          connect: ['https://api.example.com']
        }
      });
      expect(csp).toContain('https://api.example.com');
    });
  });

  describe('generateReportOnlySecurityHeaders', () => {
    it('should return all security headers', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers).toHaveProperty('Content-Security-Policy-Report-Only');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('Cross-Origin-Embedder-Policy');
      expect(headers).toHaveProperty('Cross-Origin-Opener-Policy');
      expect(headers).toHaveProperty('Cross-Origin-Resource-Policy');
    });

    it('should use Content-Security-Policy-Report-Only by default', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers).toHaveProperty('Content-Security-Policy-Report-Only');
      expect(headers).not.toHaveProperty('Content-Security-Policy');
    });

    it('should use Content-Security-Policy when reportOnly is false', () => {
      const headers = generateReportOnlySecurityHeaders({ reportOnly: false });
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).not.toHaveProperty('Content-Security-Policy-Report-Only');
    });

    it('should include HSTS header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should include X-Content-Type-Options header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should include Referrer-Policy header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include Permissions-Policy header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['Permissions-Policy']).toContain('camera=()');
    });

    it('should include X-XSS-Protection header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should include COEP header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    });

    it('should include COOP header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    });

    it('should include CORP header', () => {
      const headers = generateReportOnlySecurityHeaders();
      expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    });
  });

  describe('cspReportOnlyMiddleware', () => {
    it('should be a function', () => {
      expect(typeof cspReportOnlyMiddleware).toBe('function');
    });

    it('should return a middleware function', () => {
      const middleware = cspReportOnlyMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should apply security headers to response', async () => {
      const middleware = cspReportOnlyMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req, res, () => {});

      expect(res.setHeader).toHaveBeenCalled();
      const calls = res.setHeader.mock.calls;
      const headerKeys = calls.map(([key]: any) => key);
      expect(headerKeys).toContain('Content-Security-Policy-Report-Only');
    });

    it('should add nonce to request when useNonces is true', async () => {
      const middleware = cspReportOnlyMiddleware({ useNonces: true });
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req, res, () => {});

      expect((req as any).cspNonce).toBeDefined();
      expect(typeof (req as any).cspNonce).toBe('string');
    });

    it('should not add nonce to request when useNonces is false', async () => {
      const middleware = cspReportOnlyMiddleware({ useNonces: false });
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req, res, () => {});

      expect((req as any).cspNonce).toBeUndefined();
    });
  });

  describe('cspEnforcementMiddleware', () => {
    it('should use Content-Security-Policy header', async () => {
      const middleware = cspEnforcementMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const calls = res.setHeader.mock.calls;
      const headerKeys = calls.map(([key]: any) => key);
      expect(headerKeys).toContain('Content-Security-Policy');
      expect(headerKeys).not.toContain('Content-Security-Policy-Report-Only');
    });

    it('should add nonce to request', async () => {
      const middleware = cspEnforcementMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req, res, () => {});

      expect((req as any).cspNonce).toBeDefined();
    });
  });

  describe('validateCspConfiguration', () => {
    it('should return valid: true for a valid CSP', () => {
      const csp = generateCspHeader({ useNonces: false });
      const result = validateCspConfiguration(csp);
      expect(result.valid).toBe(true);
    });

    it('should warn about unsafe-inline', () => {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline';";
      const result = validateCspConfiguration(csp);
      expect(result.warnings).toContain('CSP contains \'unsafe-inline\'');
    });

    it('should error when required domain is missing', () => {
      const csp = "default-src 'self'; script-src 'self';";
      const result = validateCspConfiguration(csp);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.valid).toBe(false);
    });

    it('should error when required directive is missing', () => {
      const csp = "default-src 'self';";
      const result = validateCspConfiguration(csp);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.valid).toBe(false);
    });

    it('should pass when all required domains and directives are present', () => {
      const csp = generateCspHeader({ useNonces: false });
      const result = validateCspConfiguration(csp);
      expect(result.valid).toBe(true);
    });
  });

  describe('generateCspMigrationReport', () => {
    it('should generate a report with no violations', () => {
      const report = generateCspMigrationReport([]);
      expect(report).toContain('# CSP Migration Report');
      expect(report).toContain('✅ No CSP violations detected');
    });

    it('should generate a report with violations', () => {
      const violations = [
        {
          report: {
            'blocked-uri': 'https://example.com',
            'violated-directive': 'script-src',
            'source-file': 'https://app.com',
            'line-number': 42
          }
        }
      ];
      const report = generateCspMigrationReport(violations);
      expect(report).toContain('# CSP Migration Report');
      expect(report).toContain('⚠️ CSP violations detected');
      expect(report).toContain('https://example.com');
    });

    it('should include recommendations', () => {
      const report = generateCspMigrationReport([]);
      expect(report).toContain('## Recommendations');
    });
  });

  describe('defaultCspReportOnlyConfig', () => {
    it('should have reportOnly enabled by default', () => {
      expect(defaultCspReportOnlyConfig.reportOnly).toBe(true);
    });

    it('should have useNonces enabled by default', () => {
      expect(defaultCspReportOnlyConfig.useNonces).toBe(true);
    });

    it('should have reportUri undefined by default', () => {
      expect(defaultCspReportOnlyConfig.reportUri).toBeUndefined();
    });

    it('should have empty additionalDomains by default', () => {
      expect(defaultCspReportOnlyConfig.additionalDomains).toEqual({});
    });
  });

  describe('createCspViolationEndpoint', () => {
    it('should be a function', () => {
      expect(typeof createCspViolationEndpoint).toBe('function');
    });

    it('should return an endpoint handler', () => {
      const endpoint = createCspViolationEndpoint();
      expect(typeof endpoint).toBe('function');
    });

    it('should reject non-POST requests', async () => {
      const endpoint = createCspViolationEndpoint();
      const req = createMockRequest();
      req.method = 'GET';
      const res = createMockResponse();

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('should reject invalid reports', async () => {
      const endpoint = createCspViolationEndpoint();
      const req = createMockRequest();
      req.method = 'POST';
      req.body = {}; // No csp-report
      const res = createMockResponse();

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should accept valid reports', async () => {
      const endpoint = createCspViolationEndpoint();
      const req = createMockRequest();
      req.method = 'POST';
      req.body = {
        'csp-report': {
          'blocked-uri': 'https://example.com',
          'violated-directive': 'script-src'
        }
      };
      const res = createMockResponse();

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });
});

describe('CSP Report-Only - S-23 Compliance', () => {
  it('should generate CSP without unsafe-inline when useNonces is true', () => {
    const csp = generateCspHeader({ useNonces: true });
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('should maintain all required functionality', () => {
    const csp = generateCspHeader({ useNonces: false });
    const result = validateCspConfiguration(csp);
    expect(result.valid).toBe(true);
  });

  it('should be configurable for report-only or enforcement mode', () => {
    const reportOnlyHeaders = generateReportOnlySecurityHeaders({ reportOnly: true });
    const enforcementHeaders = generateReportOnlySecurityHeaders({ reportOnly: false });

    expect(reportOnlyHeaders).toHaveProperty('Content-Security-Policy-Report-Only');
    expect(enforcementHeaders).toHaveProperty('Content-Security-Policy');
  });

  it('should include all modern security headers', () => {
    const headers = generateReportOnlySecurityHeaders();
    const requiredHeaders = [
      'Content-Security-Policy-Report-Only',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'X-XSS-Protection',
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy'
    ];

    for (const header of requiredHeaders) {
      expect(headers).toHaveProperty(header);
    }
  });
});
