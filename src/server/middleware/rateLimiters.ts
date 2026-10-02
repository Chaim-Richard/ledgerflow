import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for Authentication and Password Reset endpoints.
 * 5 attempts per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for public invoice views.
 * 30 views per minute per IP.
 */
export const publicInvoiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many public invoice requests. Please slow down.'
  }
});

/**
 * Rate limiter for compute-heavy PDF generation endpoints.
 * 10 requests per minute per IP.
 */
export const pdfGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'PDF generation rate limit reached. Please wait a moment before generating more documents.'
  }
});

/**
 * Rate limiter for AI Brain & Financial LLM reasoning endpoints (/api/v1/brain/*).
 * 20 requests per minute per IP.
 */
export const brainRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'AI Brain request quota temporarily exceeded. Please throttle request intensity.'
  }
});

/**
 * The app-wide limiters (F-01, moved from server.ts). A new set per app, so each app (and each
 * test) counts on its own.
 */
export function createAppRateLimiters() {
  // Rate Limiting - Increased for production SPA load
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // increased to 1000 to prevent false positives in high-density SPA usage
    message: { status: "error", message: "Maximum rate limit reached. Please hold for calibration." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter specifically for transaction matching to prevent abuse / DOS (Strategic Key Protection)
  const matchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 matching inquiries per minute
    message: { status: "error", message: "Transaction matching rate limit exceeded. Please throttle request intensity." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Interceptor middleware for Developer API Logging
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per `window` (here, per minute)
    message: { status: "error", message: "Too many requests from this IP, please try again after a minute." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
  return { limiter, matchLimiter, apiLimiter };
}
