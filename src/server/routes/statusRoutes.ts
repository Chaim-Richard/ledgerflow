import express from 'express';
import { getDb } from '../db/firestore';
import { checkSystemStatus, type SystemStatus } from '../services/statusService';

/**
 * Public health and status (L-17), no sign-in: GET /api/health (is the server up) and
 * GET /api/v1/public/status (each part of the system, for the status page at /status). The status is
 * worked out at most every 30 seconds, so the page can't be used to load the database.
 */
export const statusRouter = express.Router();

statusRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0-PROXIMA' });
});

let cached: { at: number; status: SystemStatus } | null = null;
const CACHE_MS = 30_000;

statusRouter.get('/v1/public/status', async (_req, res) => {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { at: Date.now(), status: await checkSystemStatus(getDb()) };
  }
  res.set('Cache-Control', 'public, max-age=30');
  res.json(cached.status);
});
