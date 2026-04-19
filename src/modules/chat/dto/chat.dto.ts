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
      id: z.number().describe('The chunk identifier number'),
      sourceTitle: z.string().describe('The title of the source document'),
      excerpt: z.string().describe('A short excerpt supporting the claim'),
    }),
  ),
});

export type CitationResult = z.infer<typeof CitationSchema>;
