import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from root workspace if available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to local .env

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('debug'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/agentsauda?schema=public'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars').default('super-secure-jwt-secret-min-32-chars-long-demo'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars').default('super-secure-session-secret-min-32-chars-long'),

  RAZORPAY_KEY_ID: z.string().default('rzp_test_mock_key_id'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_test_mock_key_secret'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_test_mock_webhook_secret'),

  LLM_PROVIDER: z.string().default('gemini'),
  GEMINI_API_KEY: z.string().default('mock_gemini_api_key')
});

export type EnvConfig = z.infer<typeof EnvSchema>;

function validateEnv(): EnvConfig {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ FATAL: Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
