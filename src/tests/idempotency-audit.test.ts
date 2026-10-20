/**
 * Tests for S-05: Idempotency Audit
 * 
 * Verifies that endpoints that post money are properly guarded against duplicate posting.
 */

import { describe, it, expect } from 'node:test';
import {
  getAllMoneyPostingEndpoints,
  getGuardedEndpoints,
  getUnguardedEndpoints,
  generateIdempotencyAuditReport,
  checkEndpointIdempotency
} from '../server/services/idempotencyAudit';

describe('Idempotency Audit', () => {
  describe('getAllMoneyPostingEndpoints', () => {
    it('should return all money-posting endpoints', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      expect(endpoints.length).toBeGreaterThan(0);
    });

    it('should include transaction endpoints', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const txEndpoints = endpoints.filter(e => e.path.includes('/transactions'));
      expect(txEndpoints.length).toBeGreaterThan(0);
    });

    it('should include invoice endpoints', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const invoiceEndpoints = endpoints.filter(e => e.path.includes('/invoices'));
      expect(invoiceEndpoints.length).toBeGreaterThan(0);
    });

    it('should include payment endpoints', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const paymentEndpoints = endpoints.filter(e => e.path.includes('/payments') || e.path.includes('/pay-runs'));
      expect(paymentEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe('getGuardedEndpoints', () => {
    it('should return only guarded endpoints', () => {
      const guarded = getGuardedEndpoints();
      expect(guarded.length).toBeGreaterThan(0);
      expect(guarded.every(e => e.guardsAgainstRetry)).toBe(true);
    });

    it('should have idempotency mechanisms', () => {
      const guarded = getGuardedEndpoints();
      expect(guarded.every(e => e.idempotencyMechanism !== null)).toBe(true);
    });
  });

  describe('getUnguardedEndpoints', () => {
    it('should return unguarded endpoints', () => {
      const unguarded = getUnguardedEndpoints();
      expect(Array.isArray(unguarded)).toBe(true);
    });

    it('should return endpoints with recommended fixes', () => {
      const unguarded = getUnguardedEndpoints();
      expect(unguarded.every(e => e.recommendedFix && e.recommendedFix.length > 0)).toBe(true);
    });
  });

  describe('checkEndpointIdempotency', () => {
    it('should find known guarded endpoints', () => {
      const result = checkEndpointIdempotency('/api/v1/transactions', 'POST');
      expect(result.isGuarded).toBe(true);
      expect(result.endpoint).toBeDefined();
      expect(result.endpoint?.guardsAgainstRetry).toBe(true);
    });

    it('should find known unguarded endpoints', () => {
      const result = checkEndpointIdempotency('/api/v1/transactions/:id', 'PUT');
      expect(result.isGuarded).toBe(false);
    });

    it('should return undefined for unknown endpoints', () => {
      const result = checkEndpointIdempotency('/api/v1/unknown', 'POST');
      expect(result.isGuarded).toBe(false);
      expect(result.endpoint).toBeUndefined();
    });
  });

  describe('generateIdempotencyAuditReport', () => {
    it('should generate a report with all sections', () => {
      const report = generateIdempotencyAuditReport();
      
      expect(report).toContain('# Idempotency Audit Report');
      expect(report).toContain('##');
      expect(report).toContain('Total Money-Posting Endpoints:');
      expect(report).toContain('Guarded Endpoints:');
      expect(report).toContain('Unguarded Endpoints:');
    });

    it('should include guarded endpoints table', () => {
      const report = generateIdempotencyAuditReport();
      expect(report).toContain('## ✅ GUARDED ENDPOINTS');
      expect(report).toContain('| Method | Path |');
    });

    it('should include unguarded endpoints if any exist', () => {
      const report = generateIdempotencyAuditReport();
      const unguarded = getUnguardedEndpoints();
      
      if (unguarded.length > 0) {
        expect(report).toContain('## ⚠️ UNGUARDED ENDPOINTS');
        expect(report).toContain('A retried request CAN post twice!');
      }
    });

    it('should include recommendations for AI #1 if there are unguarded endpoints', () => {
      const report = generateIdempotencyAuditReport();
      const unguarded = getUnguardedEndpoints();
      
      if (unguarded.length > 0) {
        expect(report).toContain('## 🎯 RECOMMENDATIONS FOR AI #1');
      }
    });
  });

  describe('endpoint coverage', () => {
    it('should cover transaction creation', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const hasTxCreate = endpoints.some(e => 
        e.path === '/api/v1/transactions' && e.method === 'POST'
      );
      expect(hasTxCreate).toBe(true);
    });

    it('should cover invoice posting', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const hasInvoicePost = endpoints.some(e => 
        e.path.includes('/invoices') && e.method === 'POST'
      );
      expect(hasInvoicePost).toBe(true);
    });

    it('should cover payment posting', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const hasPaymentPost = endpoints.some(e => 
        e.path.includes('/payments') && e.method === 'POST'
      );
      expect(hasPaymentPost).toBe(true);
    });

    it('should cover bill posting', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const hasBillPost = endpoints.some(e => 
        e.path.includes('/bills') && e.method === 'POST'
      );
      expect(hasBillPost).toBe(true);
    });

    it('should cover payment run posting', () => {
      const endpoints = getAllMoneyPostingEndpoints();
      const hasPayRunPost = endpoints.some(e => 
        e.path.includes('/pay-runs') && e.method === 'POST'
      );
      expect(hasPayRunPost).toBe(true);
    });
  });

  describe('idempotency mechanism verification', () => {
    it('should verify that guarded endpoints use executeIdempotent', () => {
      const guarded = getGuardedEndpoints();
      const usingExecuteIdempotent = guarded.filter(e => 
        e.idempotencyMechanism?.includes('executeIdempotent')
      );
      
      expect(usingExecuteIdempotent.length).toBeGreaterThan(0);
    });

    it('should verify that guarded endpoints use executeCommand', () => {
      const guarded = getGuardedEndpoints();
      const usingExecuteCommand = guarded.filter(e => 
        e.idempotencyMechanism?.includes('executeCommand')
      );
      
      expect(usingExecuteCommand.length).toBeGreaterThan(0);
    });
  });
});

describe('Idempotency Audit - Endpoint Categories', () => {
  it('should categorize endpoints by risk level', () => {
    const endpoints = getAllMoneyPostingEndpoints();
    const highRisk = endpoints.filter(e => e.riskLevel === 'high');
    const mediumRisk = endpoints.filter(e => e.riskLevel === 'medium');
    const lowRisk = endpoints.filter(e => e.riskLevel === 'low');
    
    expect(highRisk.length).toBeGreaterThan(0);
    expect(mediumRisk.length).toBeGreaterThan(0);
    expect(lowRisk.length).toBeGreaterThanOrEqual(0);
  });

  it('should have more guarded than unguarded endpoints', () => {
    const guarded = getGuardedEndpoints();
    const unguarded = getUnguardedEndpoints();
    
    expect(guarded.length).toBeGreaterThan(unguarded.length);
  });
});
