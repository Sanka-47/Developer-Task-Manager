import type { CookieOptions, Response } from "express";

import { env, isProduction } from "../../config/env";

export const REFRESH_COOKIE_NAME = "taskapp_refresh";

/**
 * The refresh cookie is scoped to the auth endpoints only, is httpOnly (no
 * JavaScript access) and SameSite=Lax (not sent on cross-site POSTs), which
 * removes the need for a separate CSRF token for this flow.
 */
const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/v1/auth",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
}

export function readRefreshCookie(
  cookies: Record<string, unknown> | undefined,
): string | undefined {
  const value = cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
