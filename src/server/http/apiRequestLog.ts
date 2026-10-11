import express from "express";
import crypto from "crypto";
import { requestUser } from "../auth/requestUser";
import type { ApiLog } from "./serverKit";
import { safeRequestTarget } from "./safeRequestTarget";

/**
 * Developer Hub request log (F-01, moved from server.ts): the last 100 /api/v1 calls with status,
 * time taken and a masked key, newest first, kept in memory.
 */
export function apiRequestLogger(apiLogs: ApiLog[]): express.RequestHandler {
  return (req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function(this: express.Response, ...args: Parameters<typeof originalEnd>) {
    const latency = Date.now() - start;
    const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string) || '';
    
    let apiPart = 'Bearer Token';
    const reqUser = requestUser(req);
    
    if (reqUser && reqUser.apiKeyName) {
      apiPart = `Key: ${reqUser.apiKeyName} (${(reqUser.usedApiKeyId || '').substring(0, 10)}...)`;
    } else if (authHeader.startsWith('Bearer lf_sec_') || authHeader.startsWith('lf_sec_')) {
      const parts = authHeader.replace('Bearer ', '').split('_');
      if (parts.length >= 4) {
        apiPart = `lf_sec_${parts[2].substring(0, 4)}..._***`;
      } else {
        apiPart = 'Invalid Key Format';
      }
    } else if (authHeader.startsWith('Bearer lf_id_') || authHeader.startsWith('lf_id_')) {
      const keyPart = authHeader.replace('Bearer ', '').split('.')[0];
      apiPart = `${keyPart.substring(0, 15)}...`;
    } else if (!authHeader) {
      apiPart = 'None';
    }

    apiLogs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: safeRequestTarget(req.originalUrl || req.url || '/'),
      statusCode: res.statusCode,
      latencyMs: latency,
      apiKeyUsed: apiPart,
      ip: (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1'
    });

    if (apiLogs.length > 100) apiLogs.pop();
    return originalEnd.apply(this, args);
  } as typeof res.end;

  next();
  };
}
