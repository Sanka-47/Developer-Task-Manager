import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4200),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z
    .string({ error: "JWT_ACCESS_SECRET is required" })
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters long"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3100")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  COOKIE_DOMAIN: z.string().optional(),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  /* ---------------------------------------------------------------------- */
  /*                            Object storage                              */
  /* ---------------------------------------------------------------------- */
  AWS_REGION: z.string().trim().min(1).default("eu-central-1"),
  S3_BUCKET: z.string().trim().min(3).default("taskapp-attachments"),
  S3_ENDPOINT_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  S3_PUBLIC_ENDPOINT_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  S3_KEY_PREFIX: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9/_-]+$/,
      "S3_KEY_PREFIX may only contain letters, numbers, /, _ and -",
    )
    .default("attachments"),
  S3_UPLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(300),
  S3_DOWNLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(300),
  S3_MAX_FILE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
