let accessToken: string | null = null;

/**
 * The access token lives in a module variable, never in localStorage or a
 * readable cookie. It is lost on a full page reload by design and restored
 * from the httpOnly refresh cookie.
 */
export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  set(token: string): void {
    accessToken = token;
  },
  clear(): void {
    accessToken = null;
  },
};
