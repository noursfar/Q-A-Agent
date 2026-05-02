import { z } from 'zod';

export const envSchema = z.object({
  // ─── App ────────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  // ─── Logging ─────────────────────────────────────────────────────────────────
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),

  // ─── LLM Provider keys (text generation) ──────────────────────────────────────
  // OpenRouter
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openai/gpt-oss-120b:free'),

  // Mistral
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required'),
  MISTRAL_MODEL: z.string().default('mistral-small-latest'),

  // ─── Voyage AI (text embedding & reranking — always active) ──────────────────────────────
  VOYAGE_API_KEY: z.string().min(1, 'VOYAGE_API_KEY is required'),
  VOYAGE_MODEL: z.string().default('voyage-4-lite'),
  VOYAGE_RERANK_MODEL: z.string().default('rerank-2'),

  // ─── Qdrant Vector DB ────────────────────────────────────────────────────────
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default('wikiHub'),

  // ─── Redis (Session Storage) ─────────────────────────────────────────────────
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_TTL_MINUTES: z.coerce.number().default(30),
});

export type EnvVars = z.infer<typeof envSchema>;

/**
 * Called by ConfigModule.forRoot({ validate }) — runs on app startup.
 * Throws a descriptive error if any required vars are missing or malformed.
 */
export function validate(config: Record<string, unknown>): EnvVars {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`\n Environment validation failed:\n${formatted}\n`);
  }
  return result.data;
}
