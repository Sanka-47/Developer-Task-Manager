import type { PrismaClient } from "@prisma/client";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshTokenWithUser extends RefreshTokenRecord {
  user: UserRecord;
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

export interface CreateRefreshTokenData {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Persistence contract for authentication. Services depend on this interface
 * (dependency inversion), which keeps business logic testable without a
 * database.
 */
export interface IAuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(data: CreateUserData): Promise<UserRecord>;
  createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord>;
  findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null>;
  revokeRefreshToken(
    id: string,
    replacedByTokenHash?: string,
  ): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
} as const;

const refreshTokenSelect = {
  id: true,
  tokenHash: true,
  userId: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private readonly db: PrismaClient) {}

  findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({
      where: { email },
      select: userSelect,
    });
  }

  findUserById(id: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({
      where: { id },
      select: userSelect,
    });
  }

  createUser(data: CreateUserData): Promise<UserRecord> {
    return this.db.user.create({
      data,
      select: userSelect,
    });
  }

  createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord> {
    return this.db.refreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
      select: refreshTokenSelect,
    });
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        ...refreshTokenSelect,
        user: { select: userSelect },
      },
    });
  }

  async revokeRefreshToken(
    id: string,
    replacedByTokenHash?: string,
  ): Promise<void> {
    await this.db.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        ...(replacedByTokenHash ? { replacedByTokenHash } : {}),
      },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
