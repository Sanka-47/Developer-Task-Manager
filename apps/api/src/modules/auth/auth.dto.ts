import type { AuthUser } from "@taskapp/shared";

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface SessionDto {
  user: AuthUser;
  accessToken: string;
}

export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedSessionDto extends SessionDto {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
