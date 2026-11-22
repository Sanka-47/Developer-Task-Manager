import pino from "pino";

import { env, isDevelopment } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "taskapp-api" },
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname,service",
          },
        },
      }
    : {}),
});
