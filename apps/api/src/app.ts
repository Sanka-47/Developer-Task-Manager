import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env, isProduction } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./common/http/error-handler";
import { requestIdMiddleware } from "./common/http/request-id";
import { createContainer, type AppContainer } from "./container";
import { createApiRouter } from "./routes";

export function createApp(container: AppContainer = createContainer()): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === "/api/v1/health",
      },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: isProduction ? 86_400 : 0,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/v1", createApiRouter(container));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
