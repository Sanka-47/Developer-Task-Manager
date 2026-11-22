import type { Request, RequestHandler } from "express";

import { UnauthorizedError } from "../../common/errors/app-error";
import type { TokenService } from "./token.service";

const BEARER_PREFIX = "Bearer ";

/**
 * Verifies the access token from the Authorization header and attaches the
 * authenticated user to the request. Tokens are never read from cookies: the
 * web client holds the access token in memory.
 */
export function createAuthenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.header("authorization");

    if (!header?.startsWith(BEARER_PREFIX)) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    try {
      const payload = tokens.verifyAccessToken(
        header.slice(BEARER_PREFIX.length).trim(),
      );
      req.auth = { userId: payload.sub, email: payload.email };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(req: Request): { userId: string; email: string } {
  if (!req.auth) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.auth;
}
