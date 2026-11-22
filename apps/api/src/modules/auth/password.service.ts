import { compare, hash } from "bcryptjs";

/**
 * Thin wrapper around bcrypt so hashing policy lives in one place and can be
 * swapped or stubbed in tests.
 */
export class PasswordService {
  constructor(private readonly rounds: number) {}

  hash(plainText: string): Promise<string> {
    return hash(plainText, this.rounds);
  }

  verify(plainText: string, passwordHash: string): Promise<boolean> {
    return compare(plainText, passwordHash);
  }
}
