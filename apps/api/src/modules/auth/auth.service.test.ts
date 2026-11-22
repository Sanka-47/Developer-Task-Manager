import { describe, expect, it } from "vitest";

import type {
  CreateRefreshTokenData,
  CreateUserData,
  IAuthRepository,
  RefreshTokenRecord,
  RefreshTokenWithUser,
  UserRecord,
} from "./auth.repository";
import { AuthService } from "./auth.service";
import type { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

const START = new Date("2026-06-15T12:00:00.000Z");
const SECRET = "unit-test-secret-that-is-long-enough-1234";

class FakeAuthRepository implements IAuthRepository {
  users: UserRecord[] = [];
  refreshTokens: RefreshTokenRecord[] = [];
  private userSequence = 0;
  private tokenSequence = 0;

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async createUser(data: CreateUserData): Promise<UserRecord> {
    this.userSequence += 1;
    const user: UserRecord = {
      id: `user_${this.userSequence}`,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: START,
      updatedAt: START,
    };
    this.users.push(user);
    return user;
  }

  async createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord> {
    this.tokenSequence += 1;
    const token: RefreshTokenRecord = {
      id: `token_${this.tokenSequence}`,
      tokenHash: data.tokenHash,
      userId: data.userId,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: START,
    };
    this.refreshTokens.push(token);
    return token;
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    const token = this.refreshTokens.find(
      (candidate) => candidate.tokenHash === tokenHash,
    );
    if (!token) {
      return null;
    }
    const user = this.users.find((candidate) => candidate.id === token.userId);
    return user ? { ...token, user } : null;
  }

  async revokeRefreshToken(
    id: string,
    replacedByTokenHash?: string,
  ): Promise<void> {
    const token = this.refreshTokens.find((candidate) => candidate.id === id);
    if (token) {
      token.revokedAt = START;
      if (replacedByTokenHash) {
        (token as RefreshTokenRecord & { replacedByTokenHash?: string })
          .replacedByTokenHash = replacedByTokenHash;
      }
    }
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    for (const token of this.refreshTokens) {
      if (token.userId === userId) {
        token.revokedAt = START;
      }
    }
  }
}

function createHarness(): {
  service: AuthService;
  repository: FakeAuthRepository;
  tokens: TokenService;
  advanceDays: (days: number) => void;
} {
  const repository = new FakeAuthRepository();
  const tokens = new TokenService({ secret: SECRET, accessTtl: "15m" });
  const passwords = {
    hash: async (plain: string) => `hashed:${plain}`,
    verify: async (plain: string, hashed: string) =>
      hashed === `hashed:${plain}`,
  } as PasswordService;

  let current = new Date(START);
  const service = new AuthService({
    repository,
    tokens,
    passwords,
    refreshTtlDays: 30,
    now: () => current,
  });

  return {
    service,
    repository,
    tokens,
    advanceDays: (days) => {
      current = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);
    },
  };
}

const registerInput = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "Password123",
};

describe("AuthService", () => {
  it("registers a user and returns a usable access token", async () => {
    const { service, tokens } = createHarness();

    const session = await service.register(registerInput, {});

    expect(session.user.email).toBe("ada@example.com");
    expect(session.user).not.toHaveProperty("passwordHash");
    const payload = tokens.verifyAccessToken(session.accessToken);
    expect(payload.sub).toBe(session.user.id);
    expect(session.refreshToken.length).toBeGreaterThan(20);
  });

  it("rejects duplicate registration", async () => {
    const { service } = createHarness();
    await service.register(registerInput, {});

    await expect(service.register(registerInput, {})).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("returns the same error for unknown email and wrong password", async () => {
    const { service } = createHarness();
    await service.register(registerInput, {});

    await expect(
      service.login({ email: "nobody@example.com", password: "Password123" }, {}),
    ).rejects.toThrow("Invalid email or password");

    await expect(
      service.login(
        { email: "ada@example.com", password: "WrongPassword1" },
        {},
      ),
    ).rejects.toThrow("Invalid email or password");
  });

  it("rotates the refresh token and revokes the previous one", async () => {
    const { service, repository, tokens } = createHarness();
    const first = await service.register(registerInput, {});

    const second = await service.refresh(first.refreshToken, {});

    expect(second.refreshToken).not.toBe(first.refreshToken);

    const oldHash = tokens.hashRefreshToken(first.refreshToken);
    const oldRecord = repository.refreshTokens.find(
      (token) => token.tokenHash === oldHash,
    );
    expect(oldRecord?.revokedAt).not.toBeNull();
    expect(
      (oldRecord as RefreshTokenRecord & { replacedByTokenHash?: string })
        .replacedByTokenHash,
    ).toBe(tokens.hashRefreshToken(second.refreshToken));
  });

  it("revokes every session when a revoked refresh token is reused", async () => {
    const { service, repository, tokens } = createHarness();
    const first = await service.register(registerInput, {});
    const second = await service.refresh(first.refreshToken, {});

    await expect(service.refresh(first.refreshToken, {})).rejects.toMatchObject({
      statusCode: 401,
    });

    const secondHash = tokens.hashRefreshToken(second.refreshToken);
    const secondRecord = repository.refreshTokens.find(
      (token) => token.tokenHash === secondHash,
    );
    expect(secondRecord?.revokedAt).not.toBeNull();
    await expect(service.refresh(second.refreshToken, {})).rejects.toMatchObject(
      { statusCode: 401 },
    );
  });

  it("rejects an expired refresh token", async () => {
    const { service, advanceDays } = createHarness();
    const session = await service.register(registerInput, {});

    advanceDays(31);

    await expect(service.refresh(session.refreshToken, {})).rejects.toMatchObject(
      { statusCode: 401 },
    );
  });

  it("revokes the session on logout", async () => {
    const { service } = createHarness();
    const session = await service.register(registerInput, {});

    await service.logout(session.refreshToken);

    await expect(service.refresh(session.refreshToken, {})).rejects.toMatchObject(
      { statusCode: 401 },
    );
  });
});
