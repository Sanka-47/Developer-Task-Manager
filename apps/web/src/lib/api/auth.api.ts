import type {
  AuthSession,
  AuthUser,
  LoginInput,
  RegisterInput,
} from "@taskapp/shared";

import { apiRequest } from "./client";

export const authApi = {
  register(input: RegisterInput): Promise<AuthSession> {
    return apiRequest<AuthSession>("/auth/register", {
      method: "POST",
      body: input,
      auth: false,
      skipRefresh: true,
    }).then((response) => response.data);
  },

  login(input: LoginInput): Promise<AuthSession> {
    return apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: input,
      auth: false,
      skipRefresh: true,
    }).then((response) => response.data);
  },

  logout(): Promise<void> {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      auth: false,
      skipRefresh: true,
    }).then(() => undefined);
  },

  me(): Promise<AuthUser> {
    return apiRequest<AuthUser>("/auth/me").then((response) => response.data);
  },
};
