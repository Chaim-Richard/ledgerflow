import { errorMessage } from "../auth/requestUser";
import type { ServerContext } from "../http/serverKit";
import { apiAuthenticate } from "../auth/apiAuthenticate";
import express from "express";
import { getDb } from "../db/firestore";
import { AccountDeletionBlocked, deleteAccount } from "../services/accountDeletionService";
import { authAdmin } from "../auth/supabaseAuth";
import { recordAuthEvent } from "../services/authAuditService";

/** Routes moved out of server.ts (F-01), registered in the same place and order. */
export function registerAuthRoutes(app: express.Express, _ctx: ServerContext): void {
  // Session revocation
  app.post("/api/v1/auth/revoke-sessions", apiAuthenticate, async (req: any, res) => {
    try {
      const uid = req.user.uid;
      await authAdmin.revokeRefreshTokens(uid);
      res.json({ success: true, message: 'All active sessions revoked successfully. You will be signed out shortly.' });
    } catch (error) {
      console.error('Failed to revoke sessions:', error);
      res.status(500).json({ error: errorMessage(error) || 'Failed to revoke sessions' });
    }
  });

  // Delete user account (accountDeletionService.ts: shared books are never left without an owner)
  app.delete("/api/v1/auth/delete-account", apiAuthenticate, async (req: any, res) => {
    try {
      const result = await deleteAccount(getDb(), { uid: req.user.uid, email: req.user.email }, uid => authAdmin.deleteUser(uid));
      res.json({ success: true, message: 'Account deleted.', ...result });
    } catch (error) {
      if (error instanceof AccountDeletionBlocked) {
        return res.status(409).json({ error: errorMessage(error), workspaces: error.workspaces });
      }
      console.error('Failed to delete account:', error);
      res.status(500).json({ error: errorMessage(error) || 'Failed to delete account' });
    }
  });

  // Auth Audit Event Recording
  app.post("/api/v1/auth/audit", async (req: any, res) => {
    try {
      const { uid, event, email, metadata } = req.body || {};
      if (!uid || !event) {
        return res.status(400).json({ error: 'Missing uid or event' });
      }
      const allowedEvents = ['login', 'logout', 'failed_login', 'password_reset', 'token_refresh'];
      if (!allowedEvents.includes(event)) {
        return res.status(400).json({ error: 'Invalid event type' });
      }
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      const userAgent = (req.headers['user-agent'] as string) || 'unknown';
      const id = await recordAuthEvent({ uid, event, ip, userAgent, email, metadata });
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });
}
