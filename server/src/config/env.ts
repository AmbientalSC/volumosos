import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().default('volumosos'),
  MINIO_PUBLIC_BASE_URL: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: z.string().min(1),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
});

export const env = envSchema.parse(process.env);

export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
