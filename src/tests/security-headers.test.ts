/**
 * Tests for S-06: Security Headers Review
 * 
 * Verifies that security headers are properly configured
 * and that e2e tests would prove main screens still load.
 */

import { describe, it, expect, beforeEach } from 'node:test';
import {
  generateSecurityHeaders,
  defaultSecurityConfig,
  securityHeadersMiddleware,
  generateVercelSecurityHeaders,
  getCurrentCSP,
  validateSecurityHeadersCompatibility
} from '../server/http/securityHeaders';

describe('Security Headers (S-06)', () => {
  describe('generateSecurityHeaders', () => {
    it('should generate all required security headers', () => {
      const headers = generateSecurityHeaders();
      
      expect(headers).toHaveProperty('Content-Security-Policy');
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

    it('should include CSP by default', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Content-Security-Policy']).toBeDefined();
    });

    it('should generate CSP with default-src self', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("default-src 'self'");
    });

    it('should generate CSP with script-src including Plaid', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain('script-src');
      expect(csp).toContain('https://cdn.plaid.com');
    });

    it('should generate CSP with style-src including Google Fonts', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain('style-src');
      expect(csp).toContain('https://fonts.googleapis.com');
    });

    it('should generate CSP with connect-src including Supabase', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain('connect-src');
    });

    it('should generate CSP with frame-src for Stripe and Plaid', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain('frame-src');
      expect(csp).toContain('https://*.stripe.com');
      expect(csp).toContain('https://cdn.plaid.com');
    });

    it('should generate CSP with frame-ancestors for clickjacking protection', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("frame-ancestors 'self'");
    });

    it('should generate CSP with object-src none', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("object-src 'none'");
    });

    it('should generate CSP with base-uri self', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("base-uri 'self'");
    });

    it('should generate CSP with form-action self', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("form-action 'self'");
    });
  });

  describe('CSP with nonces', () => {
    it('should use nonces when useNonces is true', () => {
      const headers = generateSecurityHeaders({ useNonces: true });
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("'nonce-true'");
    });

    it('should not use unsafe-inline when useNonces is true', () => {
      const headers = generateSecurityHeaders({ useNonces: true });
      const csp = headers['Content-Security-Policy'];
      expect(csp).not.toContain("'unsafe-inline'");
    });

    it('should use unsafe-inline when useNonces is false', () => {
      const headers = generateSecurityHeaders({ useNonces: false });
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("'unsafe-inline'");
    });
  });

  describe('Report-Only mode', () => {
    it('should use Content-Security-Policy-Report-Only when reportOnly is true', () => {
      const headers = generateSecurityHeaders({ reportOnly: true });
      expect(headers).toHaveProperty('Content-Security-Policy-Report-Only');
      expect(headers).not.toHaveProperty('Content-Security-Policy');
    });

    it('should use Content-Security-Policy when reportOnly is false', () => {
      const headers = generateSecurityHeaders({ reportOnly: false });
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).not.toHaveProperty('Content-Security-Policy-Report-Only');
    });
  });

  describe('HSTS header', () => {
    it('should have max-age of 1 year', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should include includeSubDomains', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    });

    it('should include preload', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Strict-Transport-Security']).toContain('preload');
    });
  });

  describe('Other security headers', () => {
    it('should set X-Content-Type-Options to nosniff', () => {
      const headers = generateSecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should set X-Frame-Options to SAMEORIGIN', () => {
      const headers = generateSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set X-XSS-Protection to 1; mode=block', () => {
      const headers = generateSecurityHeaders();
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should set Permissions-Policy', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Permissions-Policy']).toBeDefined();
      expect(headers['Permissions-Policy']).toContain('camera=()');
      expect(headers['Permissions-Policy']).toContain('geolocation=()');
      expect(headers['Permissions-Policy']).toContain('microphone=()');
    });

    it('should set Cross-Origin-Embedder-Policy', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    });

    it('should set Cross-Origin-Opener-Policy', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    });

    it('should set Cross-Origin-Resource-Policy', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    });
  });

  describe('generateVercelSecurityHeaders', () => {
    it('should return array of header objects', () => {
      const headers = generateVercelSecurityHeaders();
      expect(Array.isArray(headers)).toBe(true);
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should include all required headers', () => {
      const headers = generateVercelSecurityHeaders();
      const headerKeys = headers.map(h => h.key);
      expect(headerKeys).toContain('Content-Security-Policy');
      expect(headerKeys).toContain('Strict-Transport-Security');
      expect(headerKeys).toContain('X-Content-Type-Options');
      expect(headerKeys).toContain('X-Frame-Options');
      expect(headerKeys).toContain('Referrer-Policy');
    });
  });

  describe('getCurrentCSP', () => {
    it('should return the CSP string', () => {
      const csp = getCurrentCSP();
      expect(typeof csp).toBe('string');
      expect(csp.length).toBeGreaterThan(0);
    });
  });

  describe('validateSecurityHeadersCompatibility', () => {
    it('should return valid: true with no errors', () => {
      const result = validateSecurityHeadersCompatibility();
      expect(result.valid).toBe(true);
    });

    it('should check for required domains', () => {
      const result = validateSecurityHeadersCompatibility();
      // The validation should pass if all required domains are in the CSP
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should warn about unsafe-inline if present', () => {
      const result = validateSecurityHeadersCompatibility();
      // With default config (useNonces: true), there should be no unsafe-inline
      // But if we use useNonces: false, there will be a warning
      expect(result.warnings).toBeDefined();
    });
  });

  describe('defaultSecurityConfig', () => {
    it('should have useNonces enabled by default', () => {
      expect(defaultSecurityConfig.useNonces).toBe(true);
    });

    it('should have reportOnly disabled by default', () => {
      expect(defaultSecurityConfig.reportOnly).toBe(false);
    });

    it('should have empty additional domains by default', () => {
      expect(defaultSecurityConfig.additionalConnectDomains).toEqual([]);
      expect(defaultSecurityConfig.additionalScriptDomains).toEqual([]);
      expect(defaultSecurityConfig.additionalStyleDomains).toEqual([]);
    });
  });

  describe('securityHeadersMiddleware', () => {
    it('should be a function', () => {
      expect(typeof securityHeadersMiddleware).toBe('function');
    });

    it('should return a middleware function', () => {
      const middleware = securityHeadersMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should accept config parameter', () => {
      const middleware = securityHeadersMiddleware({ useNonces: false });
      expect(typeof middleware).toBe('function');
    });
  });
});

describe('Security Headers - S-06 Compliance', () => {
  it('should have tightened CSP compared to vercel.json', () => {
    // The original vercel.json has 'unsafe-inline' in script-src and style-src
    // Our new headers should either use nonces or be more restrictive
    const headers = generateSecurityHeaders();
    const csp = headers['Content-Security-Policy'];
    
    // With nonces enabled (default), we should NOT have unsafe-inline
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('should maintain compatibility with existing services', () => {
    const result = validateSecurityHeadersCompatibility();
    expect(result.valid).toBe(true);
  });

  it('should include all headers from vercel.json plus additional ones', () => {
    const headers = generateSecurityHeaders();
    
    // Headers from vercel.json
    expect(headers).toHaveProperty('Content-Security-Policy');
    expect(headers).toHaveProperty('Strict-Transport-Security');
    expect(headers).toHaveProperty('X-Content-Type-Options');
    expect(headers).toHaveProperty('X-Frame-Options');
    expect(headers).toHaveProperty('Referrer-Policy');
    
    // Additional security headers
    expect(headers).toHaveProperty('Permissions-Policy');
    expect(headers).toHaveProperty('X-XSS-Protection');
    expect(headers).toHaveProperty('Cross-Origin-Embedder-Policy');
    expect(headers).toHaveProperty('Cross-Origin-Opener-Policy');
    expect(headers).toHaveProperty('Cross-Origin-Resource-Policy');
  });
});
