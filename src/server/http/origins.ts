/**
 * Which browser origins may call the API (CORS and the CSRF check), and the port to listen on
 * (F-01, moved from server.ts). Settings are read when called, so tests can pass their own.
 */
export function createOriginCheck(env: NodeJS.ProcessEnv = process.env): (origin: string) => boolean {
  const allowedOriginsEnv = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : null;

const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return true;
  
  if (allowedOriginsEnv && allowedOriginsEnv.includes(origin)) {
    return true;
  }
  
  if (env.APP_URL && (origin === env.APP_URL || origin === env.APP_URL.replace(/\/$/, ''))) {
    return true;
  }

  // This project's own Vercel deployments (production and preview URLs Vercel sets at runtime)
  const vercelHosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);
  if (vercelHosts.some(host => origin === `https://${host}`)) {
    return true;
  }

  // Localhost & loopback
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(origin)) {
    return true;
  }

  // Cloud Run and Google Cloud subdomains (*.run.app, *.us-east1.run.app, etc.)
  if (/^https:\/\/([a-z0-9-]+\.)*run\.app(:[0-9]+)?$/.test(origin)) {
    return true;
  }

  // Google AI Studio & Google domains
  if (/^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com|aistudio\.google\.com|ai\.studio)(:[0-9]+)?$/.test(origin)) {
    return true;
  }

  // Firebase & Dev Workstations
  if (/^https:\/\/([a-z0-9-]+\.)*(web\.app|firebaseapp\.com|cloudworkstations\.dev)(:[0-9]+)?$/.test(origin)) {
    return true;
  }

  // Local private network development check (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:[0-9]+)?$/.test(origin)) {
    return true;
  }

  return false;
};
  return isAllowedOrigin;
}

/** Running behind the AI Studio preview proxy (it frames the app and owns port 8080). */
export function isAiStudioProxy(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.APPLET_ID || env.NGINX_PORT || env.IS_AI_STUDIO_PREVIEW);
}

/**
 * Port Resolution:
 * In AI Studio preview containers, Nginx reverse proxy listens on NGINX_PORT (8080) and routes to DEFAULT_APP_PORT (3000).
 * In standalone deployments (Cloud Run, Heroku, Render, local Docker), Node listens directly on process.env.PORT.
 */
export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  return isAiStudioProxy(env) ? Number(env.DEFAULT_APP_PORT || 3000) : (Number(env.PORT) || 3000);
}
