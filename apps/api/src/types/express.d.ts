import type { AuthContext } from "../auth/auth-context";
import type { ValidatedInputs } from "../http/validate";

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned by `requestIdMiddleware`. */
      requestId: string;
      /** Present when the request passed the authentication middleware. */
      auth?: AuthContext;
      /** Parsed and sanitised input from `validate()`. */
      validated: ValidatedInputs;
    }
  }
}

export {};
