import { z } from 'zod';

// ─── Request DTO ──────────────────────────────────────────────────────────────

/**
 * Incoming request schema for POST /chat
 * Requires a message (the user's query) and a sessionId (for conversation memory).
 */
export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  sessionId: z.string().min(1, 'Session ID is required'),
});

export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;

// ─── Structured Output DTO ────────────────────────────────────────────────────

/**
 * Citation schema exactly as required by PROJECT_GOAL.md §2.
 * The AI SDK's generateObject will use this to structure the trailing citations block.
 */
export const CitationSchema = z.object({
  citations: z.array(
    z.object({
      claim: z.string().describe('The specific factual claim from the answer'),
      sourceTitle: z.string().describe('The title of the source document'),
      chunkIndex: z.number().describe('The exact chunk index for traceability'),
    }),
  ),
  uncitedClaims: z
    .array(z.string())
    .describe(
      'Claims that could not be traced to any source (potential hallucinations)',
    ),
});

export type CitationResult = z.infer<typeof CitationSchema>;
