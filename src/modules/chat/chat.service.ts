import { Injectable, Inject, Logger } from '@nestjs/common';
import type { LanguageModel, ModelMessage } from 'ai';
import { streamText, generateObject } from 'ai';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import { RerankResult } from '../retrieval/dto/retrieval.dto.js';
import { buildSystemPrompt } from '../../common/prompts/system.prompt.js';
import { buildCitationPrompt } from '../../common/prompts/citation.prompt.js';
import { CitationSchema, CitationResult } from './dto/chat.dto.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum messages preserved per session (sliding window) */
const MAX_SESSION_MESSAGES = 10;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  /**
   * In-memory session store.
   * sessionId -> CoreMessage[]
   */
  private readonly sessions = new Map<string, ModelMessage[]>();

  constructor(
    @Inject('LLM_MODEL') private readonly model: LanguageModel,
    private readonly retrievalService: RetrievalService,
  ) {}

  // ─── Session Memory Helpers ─────────────────────────────────────────────────

  private getHistory(sessionId: string): ModelMessage[] {
    return this.sessions.get(sessionId) ?? [];
  }

  /**
   * Appends a message to the session history and applies the sliding window.
   * When history exceeds MAX_SESSION_MESSAGES, the oldest messages are dropped
   * from the front of the array, ensuring we always keep the most recent N turns.
   */
  private saveMessage(sessionId: string, message: ModelMessage): void {
    const history = this.sessions.get(sessionId) ?? [];
    history.push(message);

    if (history.length > MAX_SESSION_MESSAGES) {
      history.splice(0, history.length - MAX_SESSION_MESSAGES);
    }

    this.sessions.set(sessionId, history);
  }

  // ─── Main Orchestrator ──────────────────────────────────────────────────────

  /**
   * Executes the full RAG → Stream → Citations pipeline.
   *
   * Flow:
   *   1. Retrieve top-5 reranked chunks from Qdrant via RetrievalService
   *   2. Inject chunks into the system prompt via buildSystemPrompt()
   *   3. Call streamText() with conversation history + new user message
   *   4. Return the live stream result AND a lazy getCitations() callback
   *      that the controller will call after the stream is consumed
   *
   * The two-phased return allows the controller to:
   *   a) Pipe the text stream to FastifyReply immediately (low latency)
   *   b) Await getCitations() after the stream finishes to append the
   *      structured citations block
   */
  async chat(
    message: string,
    sessionId: string,
  ): Promise<{
    streamResult: ReturnType<typeof streamText>;
    getCitations: () => Promise<CitationResult>;
  }> {
    this.logger.log(`[${sessionId}] Incoming: "${message}"`);

    // ── Stage 1: Retrieve relevant context ──────────────────────────────────
    const context = await this.retrievalService.retrieve(message);
    this.logger.log(
      `[${sessionId}] Retrieval returned ${context.length} reranked chunks`,
    );

    // ── Stage 2: Build system prompt with injected context ──────────────────
    const systemPrompt = buildSystemPrompt(context, message);

    // ── Stage 3: Load conversation history and append the new user message ──
    const history = this.getHistory(sessionId);
    const userMessage: ModelMessage = { role: 'user', content: message };

    // ── Stage 4: Start streaming ─────────────────────────────────────────────
    // The `system` parameter is separate from `messages` so that session history
    // only contains the actual conversation turns (user/assistant), not repeated
    // context blocks — keeping the sliding window token-efficient.
    const streamResult = streamText({
      model: this.model,
      system: systemPrompt,
      messages: [...history, userMessage],
      onError: ({ error }) => {
        this.logger.error(
          `[${sessionId}] LLM generation error: ${String(error)}`,
        );
      },
    });

    // ── Stage 5: Return stream + lazy citations builder ──────────────────────
    return {
      streamResult,

      /**
       * Called by the controller AFTER the stream is fully consumed.
       * Awaits the complete answer text, persists both messages to session
       * memory, then generates the structured CitationSchema object.
       */
      getCitations: async (): Promise<CitationResult> => {
        const fullAnswer = await streamResult.text;
        this.logger.log(
          `[${sessionId}] Stream complete. Generating citations...`,
        );

        // Persist to session memory after we have the full answer
        this.saveMessage(sessionId, userMessage);
        this.saveMessage(sessionId, {
          role: 'assistant',
          content: fullAnswer,
        });

        return this.generateCitations(fullAnswer, context);
      },
    };
  }

  // ─── Structured Citations ───────────────────────────────────────────────────

  /**
   * Uses the AI SDK's generateObject to extract a structured citations block
   * from the completed answer text, validated with CitationSchema (Zod).
   */
  private async generateCitations(
    answer: string,
    context: RerankResult[],
  ): Promise<CitationResult> {
    // Use the dedicated citation extraction prompt built in Phase 4
    const citationPrompt = buildCitationPrompt(answer, context);

    const { object } = await generateObject({
      model: this.model,
      schema: CitationSchema,
      prompt: citationPrompt,
    });

    return object;
  }
}
