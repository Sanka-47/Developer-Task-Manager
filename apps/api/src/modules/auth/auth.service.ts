import {
  ConflictError,
  UnauthorizedError,
} from "../../common/errors/app-error";
import { AuthMapper } from "./auth.mapper";
import type {
  IssuedSessionDto,
  LoginDto,
  RegisterDto,
  RequestMetadata,
  SessionDto,
} from "./auth.dto";
import type { IAuthRepository, UserRecord } from "./auth.repository";
import type { PasswordService } from "./password.service";
import type { TokenService } from "./token.service";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AuthServiceDependencies {
  repository: IAuthRepository;
  tokens: TokenService;
  passwords: PasswordService;
  refreshTtlDays: number;
  /** Injectable clock to keep token-expiry logic deterministic in tests. */
  now?: () => Date;
}

export class AuthService {
  private readonly repository: IAuthRepository;
  private readonly tokens: TokenService;
  private readonly passwords: PasswordService;
  private readonly refreshTtlDays: number;
  private readonly now: () => Date;

  constructor(dependencies: AuthServiceDependencies) {
    this.repository = dependencies.repository;
    this.tokens = dependencies.tokens;
    this.passwords = dependencies.passwords;
    this.refreshTtlDays = dependencies.refreshTtlDays;
    this.now = dependencies.now ?? (() => new Date());
  }

  async register(
    input: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<IssuedSessionDto> {
    const existing = await this.repository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.repository.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    return this.issueSession(user, metadata);
  }

  async login(
    input: LoginDto,
    metadata: RequestMetadata,
  ): Promise<IssuedSessionDto> {
    const user = await this.repository.findUserByEmail(input.email);

    // Same message for unknown email and wrong password to avoid revealing
    // which accounts exist.
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await this.passwords.verify(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return this.issueSession(user, metadata);
  }

  /**
   * Rotates the refresh token. Reusing a revoked token is treated as theft:
   * every active session for that user is revoked immediately.
   */
  async refresh(
    rawRefreshToken: string,
    metadata: RequestMetadata,
  ): Promise<IssuedSessionDto> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedError("Invalid session. Please sign in again.");
    }

    if (stored.revokedAt) {
      await this.repository.revokeAllRefreshTokens(stored.userId);
      throw new UnauthorizedError("Session has been revoked. Please sign in again.");
    }

    if (stored.expiresAt.getTime() <= this.now().getTime()) {
      await this.repository.revokeRefreshToken(stored.id);
      throw new UnauthorizedError("Session has expired. Please sign in again.");
    }

    const session = await this.issueSession(stored.user, metadata);
    await this.repository.revokeRefreshToken(
      stored.id,
      this.tokens.hashRefreshToken(session.refreshToken),
    );

    return session;
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.repository.findRefreshTokenByHash(tokenHash);
    if (stored && !stored.revokedAt) {
      await this.repository.revokeRefreshToken(stored.id);
    }
  }

  async getCurrentUser(userId: string): Promise<SessionDto["user"]> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError("Account no longer exists");
    }
    return AuthMapper.toDto(user);
  }

  private async issueSession(
    user: UserRecord,
    metadata: RequestMetadata,
  ): Promise<IssuedSessionDto> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = this.tokens.generateRefreshToken();
    const refreshTokenExpiresAt = new Date(
      this.now().getTime() + this.refreshTtlDays * MILLISECONDS_PER_DAY,
    );

    await this.repository.createRefreshToken({
      tokenHash: this.tokens.hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: refreshTokenExpiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    });

    return {
      user: AuthMapper.toDto(user),
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }
}
