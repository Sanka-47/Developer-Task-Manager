import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";

import { env } from "../../config/env";

function createLimiter(options: {
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skip: () => env.NODE_ENV === "test",
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        },
      });
    },
  });
}

/** Guards credential endpoints against brute-force attempts. */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
});

/** Refresh is called on page load and token expiry, so allow more headroom. */
export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
});
