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
