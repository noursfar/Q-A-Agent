import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ChatService } from './chat.service.js';
import { ChatRequestSchema } from './dto/chat.dto.js';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat
   *
   * Accepts { message, sessionId } and returns a Server-Sent Events (SSE) stream.
   *
   * Event protocol:
   *   event: text       — each streamed text chunk from the LLM
   *   event: citations  — structured citations block produced by generateObject after stream ends
   *   event: done       — signals the client the stream is complete
   *   event: error      — signals a server-side error mid-stream
   *
   * Why SSE over the raw AI SDK data stream?
   * SSE gives us named event types, allowing the client to cleanly distinguish
   * the text stream from the trailing citations block — which is exactly what
   * the PROJECT_GOAL.md §2 spec requires (stream answer THEN citations block).
   */
  @Post()
  async chat(@Body() body: unknown, @Res() reply: FastifyReply): Promise<void> {
    // ── 1. Validate the request body with Zod ─────────────────────────────────
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      await reply.status(HttpStatus.BAD_REQUEST).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
      return;
    }

    const { message, sessionId } = parsed.data;
    this.logger.log(`[${sessionId}] POST /chat — "${message}"`);

    // ── 2. Start the RAG pipeline ─────────────────────────────────────────────
    const { streamResult, getCitations } = await this.chatService.chat(
      message,
      sessionId,
    );

    // ── 3. Open the SSE stream ────────────────────────────────────────────────
    reply.raw.writeHead(HttpStatus.OK, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells Nginx not to buffer this response — critical for real-time streaming
      'X-Accel-Buffering': 'no',
    });

    try {
      // ── 4. Stream each text chunk as an SSE `text` event ───────────────────
      for await (const chunk of streamResult.textStream) {
        reply.raw.write(`event: text\ndata: ${JSON.stringify(chunk)}\n\n`);
      }

      // ── 5. After stream, run generateObject for citations ──────────────────
      // getCitations() awaits streamResult.text (already resolved at this point),
      // saves the exchange to session memory, and calls buildCitationPrompt +
      // generateObject to produce the structured CitationSchema object.
      const citations = await getCitations();
      reply.raw.write(
        `event: citations\ndata: ${JSON.stringify(citations)}\n\n`,
      );

      // ── 6. Signal completion ───────────────────────────────────────────────
      reply.raw.write('event: done\ndata: [DONE]\n\n');
    } catch (err) {
      this.logger.error(`[${sessionId}] Stream error: ${String(err)}`);
      // Write an error event before closing — gives the client a chance to surface it
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ message: 'An error occurred during generation' })}\n\n`,
      );
    } finally {
      reply.raw.end();
    }
  }
}
