import type { AuthUser } from "@taskapp/shared";

import type { UserRecord } from "./auth.repository";

export class AuthMapper {
  static toDto(user: UserRecord): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
