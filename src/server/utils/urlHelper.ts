import { Request } from 'express';

/**
 * Safely determines the application base URL, strictly preventing Host-header poisoning (#85).
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
    
    // Strict hostname validation: only allow local and known platform hosts
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanHost);
    const isTrustedCloud = /^[a-z0-9-.]+\.(aistudio-hub\.google\.com|run\.app|web\.app|firebaseapp\.com)(:\d+)?$/.test(cleanHost);
    
    if (isLocal || isTrustedCloud) {
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      return `${protocol}://${cleanHost}`;
    }
  }

  // Safe fallback default
  return 'http://localhost:3000';
}
