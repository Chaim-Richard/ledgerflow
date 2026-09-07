import { Request } from 'express';

/**
 * Safely determines the application base URL, strictly preventing Host-header poisoning (#85, #85-R, N6).
 */
export function getTrustedAppUrl(req?: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL.replace(/\/+$/, '');
  }
  
  if (req) {
    const rawHost = req.get('x-forwarded-host') || req.get('host') || '';
    const cleanHost = rawHost.split(',')[0].trim().toLowerCase();
    
    // In local development, permit localhost/127.0.0.1
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanHost);
    if (isLocal && process.env.NODE_ENV !== 'production') {
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      return `${protocol}://${cleanHost}`;
    }

    // Explicit trusted first-party domain
    const isFirstParty = /^(?:[a-z0-9-]+\.)*ledgerflow\.app(?::\d+)?$/.test(cleanHost);
    if (isFirstParty) {
      return `https://${cleanHost}`;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://ledgerflow.app';
  }

  // Safe fallback default for development
  return 'http://localhost:3000';
}
