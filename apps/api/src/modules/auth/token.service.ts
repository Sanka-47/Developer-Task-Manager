import { createHash, randomBytes } from "node:crypto";

import jwt, { type SignOptions } from "jsonwebtoken";

import { UnauthorizedError } from "../../common/errors/app-error";

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface TokenServiceConfig {
  secret: string;
  accessTtl: string;
  issuer?: string;
  audience?: string;
}

const REFRESH_TOKEN_BYTES = 48;

/**
 * Signs short-lived access tokens and creates opaque refresh tokens.
 *
 * Refresh tokens are random, never JWTs: only their SHA-256 hash is stored in
 * the database, so a database leak cannot be replayed as a session.
 */
export class TokenService {
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly config: TokenServiceConfig) {
    this.issuer = config.issuer ?? "taskapp-api";
    this.audience = config.audience ?? "taskapp-web";
  }

  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.accessTtl as SignOptions["expiresIn"],
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (
        typeof decoded === "string" ||
        typeof decoded.sub !== "string" ||
        typeof decoded.email !== "string"
      ) {
        throw new Error("Malformed token payload");
      }

      return { sub: decoded.sub, email: decoded.email };
    } catch {
      throw new UnauthorizedError(
        "Your session has expired. Please sign in again.",
      );
    }
  }

  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
