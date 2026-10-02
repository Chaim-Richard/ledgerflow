import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { supabaseUrl } from "../auth/supabaseAuth";
import { isAiStudioProxy } from "./origins";

/** CORS, proxy trust, compression, security headers and request logging (F-01, moved from server.ts). */
export function applySecurityMiddleware(app: express.Express, isAllowedOrigin: (origin: string) => boolean): void {
  const aiStudioProxy = isAiStudioProxy();
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true
  }));

  // Efficiency & Security Middleware
  app.set("trust proxy", 1); 
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.plaid.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        // Supabase: data (https) and live updates (wss)
        connectSrc: ["'self'", supabaseUrl(), supabaseUrl().replace(/^http/, "ws"), "https://*.plaid.com", "https://*.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        frameSrc: ["'self'", "https://*.stripe.com", "https://cdn.plaid.com"],
        frameAncestors: aiStudioProxy ? ["*"] : ["'self'"]
      }
    } : false,
    crossOriginEmbedderPolicy: false,
    frameguard: aiStudioProxy ? false : { action: 'sameorigin' },
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(morgan("tiny", {
    skip: (req) => !req.url || !req.url.startsWith("/api")
  }));
}
