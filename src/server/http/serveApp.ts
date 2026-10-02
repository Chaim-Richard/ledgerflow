import express from "express";
import path from "path";
import fs from "fs";
import { runDailyMaintenance } from "../services/maintenanceService";
import { processAllRecurring } from "../services/recurringService";
import { processErrorDigest } from "../services/errorDigestService";

/**
 * Long-running server (npm run dev / npm start), F-01 moved from server.ts: the API app plus the
 * web pages (Vite in development, dist/ in production), the daily timers and a graceful shutdown.
 * On Vercel none of this runs: api/index.mjs serves createApp() and the cron jobs run the timers.
 */
export async function serveApp(app: express.Express, PORT: number): Promise<void> {
  const http = await import('http');
  const httpServer = http.createServer(app);

  // Daily maintenance (on Vercel the cron job runs it instead)
  setInterval(() => {
    runDailyMaintenance().catch(e => console.error("[Data Lifecycle] Cleanup job failed", e));
  }, 24 * 60 * 60 * 1000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust dist path resolution for standalone and container deployments
    const candidatePaths = [
      path.join(process.cwd(), 'dist'),
      path.join(__dirname, 'dist'),
      path.join(__dirname, '../dist'),
      process.cwd()
    ];
    const distPath = candidatePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.debug(`💥 Port ${PORT} is in use, retrying...`);
      setTimeout(() => {
        httpServer.close();
        httpServer.listen(PORT, "0.0.0.0");
      }, 1000);
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.debug(`🚀 [Server] Production Ready: http://localhost:${PORT}`);
    console.debug(`📂 [Server] Serving static assets from: ${process.env.NODE_ENV === "production" ? "dist" : "Vite Dev Server"}`);

    // Single boot check for due recurring items with idempotency protection.
    // Ongoing processing runs through the authenticated /api/v1/system/recurring/process endpoint.
    processAllRecurring().catch(err => console.error('[RecurringService] Initial boot run failed:', err));

    // Daily error telemetry digest schedule (24h cadence).
    // Can also be triggered on-demand via POST /api/v1/system/telemetry/errors/digest.
    const ERROR_DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000;
    setInterval(() => {
      processErrorDigest().catch(err => console.warn('[ErrorDigestService] Scheduled digest run failed:', err));
    }, ERROR_DIGEST_INTERVAL_MS);
  });

  const gracefulShutdown = (signal: string) => {
    console.debug(`🛑 [Server] Received ${signal}. Shutting down gracefully...`);
    httpServer.close(() => {
      console.debug('👋 [Server] Closed remaining connections. Exiting process.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('💥 [Server] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
