import type { Request, Response } from "express";

import { UnauthorizedError } from "../../common/errors/app-error";
import { sendNoContent, sendSuccess } from "../../common/http/api-response";
import type {
  LoginDto,
  RegisterDto,
  RequestMetadata,
} from "./auth.dto";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./auth.cookies";
import type { AuthService } from "./auth.service";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const session = await this.service.register(
      req.validated.body as RegisterDto,
      this.metadata(req),
    );

    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    sendSuccess(
      res,
      { user: session.user, accessToken: session.accessToken },
      201,
    );
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const session = await this.service.login(
      req.validated.body as LoginDto,
      this.metadata(req),
    );

    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    sendSuccess(res, {
      user: session.user,
      accessToken: session.accessToken,
    });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const rawToken = readRefreshCookie(req.cookies as Record<string, unknown>);

    if (!rawToken) {
      clearRefreshCookie(res);
      throw new UnauthorizedError("No active session. Please sign in.");
    }

    const session = await this.service.refresh(rawToken, this.metadata(req));

    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    sendSuccess(res, {
      user: session.user,
      accessToken: session.accessToken,
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const rawToken = readRefreshCookie(req.cookies as Record<string, unknown>);
    await this.service.logout(rawToken);
    clearRefreshCookie(res);
    sendNoContent(res);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.getCurrentUser(req.auth!.userId);
    sendSuccess(res, user);
  };

  private metadata(req: Request): RequestMetadata {
    return {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    };
  }
}
