import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LanguageModel, ModelMessage } from 'ai';
import { streamText, generateObject } from 'ai';
import Redis from 'ioredis';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import { RerankResult } from '../retrieval/dto/retrieval.dto.js';
import { buildSystemPrompt } from '../../common/prompts/system.prompt.js';
import { buildCitationPrompt } from '../../common/prompts/citation.prompt.js';
import { CitationSchema, CitationResult } from './dto/chat.dto.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum messages preserved per session (sliding window) */
const MAX_SESSION_MESSAGES = 10;
const SESSION_PREFIX = 'sessions:';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly ttlSeconds: number;

  constructor(
    @Inject('LLM_MODEL') private readonly model: LanguageModel,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly retrievalService: RetrievalService,
  ) {
    this.ttlSeconds = this.configService.get<number>('REDIS_TTL_MINUTES')! * 60;
  }

  private getSessionKey(sessionId: string): string {
    return `${SESSION_PREFIX}${sessionId}`;
  }

  private async getHistory(sessionId: string): Promise<ModelMessage[]> {
    try {
      const data = await this.redis.get(this.getSessionKey(sessionId));
      if (!data) return [];
      return JSON.parse(data) as ModelMessage[];
    } catch (error) {
      this.logger.error(`Failed to get session ${sessionId}: ${String(error)}`);
      return [];
    }
  }

  private async saveMessage(
    sessionId: string,
    message: ModelMessage,
  ): Promise<void> {
    try {
      const history = await this.getHistory(sessionId);
      history.push(message);

      if (history.length > MAX_SESSION_MESSAGES) {
        history.splice(0, history.length - MAX_SESSION_MESSAGES);
      }

      const key = this.getSessionKey(sessionId);
      await this.redis.set(key, JSON.stringify(history), 'EX', this.ttlSeconds);
    } catch (error) {
      this.logger.error(
        `Failed to save session ${sessionId}: ${String(error)}`,
      );
    }
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
    const history = await this.getHistory(sessionId);
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

        await this.saveMessage(sessionId, userMessage);
        await this.saveMessage(sessionId, {
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
    const citationPrompt = buildCitationPrompt(answer, context);

    const { object } = await generateObject({
      model: this.model,
      schema: CitationSchema,
      prompt: citationPrompt,
    });

    return object;
  }
}
