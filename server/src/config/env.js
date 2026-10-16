import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  LLM_PROVIDER: z.enum(['gemini', 'openai', 'deterministic']).default('deterministic'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  POLL_INTERVAL_MS: z.coerce.number().default(15000),
  MAX_CONCURRENT_POLLS: z.coerce.number().default(3),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  MAX_REPOSITORIES_PER_SCAN: z.coerce.number().default(5),
  MAX_FILES_PER_REPOSITORY: z.coerce.number().default(100),
  MAX_FILE_SIZE_KB: z.coerce.number().default(200),
  MAX_TOTAL_SCAN_SIZE_MB: z.coerce.number().default(10),
  GITHUB_REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
