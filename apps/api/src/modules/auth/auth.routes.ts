import { Router } from "express";

import {
  loginSchema,
  registerSchema,
} from "@taskapp/shared";

import { asyncHandler } from "../../common/http/async-handler";
import { validate } from "../../common/http/validate";
import {
  authLimiter,
  refreshLimiter,
} from "../../common/middleware/rate-limit";
import type { RequestHandler } from "express";
import type { AuthController } from "./auth.controller";

export function createAuthRouter(
  controller: AuthController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/register",
    authLimiter,
    validate({ body: registerSchema }),
    asyncHandler(controller.register),
  );

  router.post(
    "/login",
    authLimiter,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
  );

  router.post("/refresh", refreshLimiter, asyncHandler(controller.refresh));

  router.post("/logout", asyncHandler(controller.logout));

  router.get("/me", authenticate, asyncHandler(controller.me));

  return router;
}
