import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';
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
   * Accepts { message, sessionId } and returns a UI Message Stream Protocol response.
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

    // ── 3. Create a UIMessageStream ───────────────────────────────────────────
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        // Merge the text stream into the UI Message Stream
        writer.merge(streamResult.toUIMessageStream());

        // Wait for text generation to finish, then generate & stream citations
        (async () => {
          try {
            await streamResult.text;
            const citations = await getCitations();
            writer.write({
              type: 'data-citations',
              data: citations,
            });
          } catch (error) {
            this.logger.error(
              `[${sessionId}] Citations error: ${String(error)}`,
            );
            writer.write({
              type: 'error',
              errorText: 'Failed to generate citations',
            });
          }
        })();
      },
      onError: (error) => {
        this.logger.error(`[${sessionId}] Stream error: ${String(error)}`);
        return error instanceof Error
          ? error.message
          : 'An error occurred during generation';
      },
    });

    // ── 4. Pipe stream to the Fastify reply ───────────────────────────────────
    pipeUIMessageStreamToResponse({ stream, response: reply.raw });
  }
}
