import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetrievalModule } from '../retrieval/retrieval.module.js';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { createLlmModel } from '../../common/utils/llm-provider.factory.js';

@Module({
  imports: [RetrievalModule], // Gives us access to RetrievalService
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      // Invokes our LLM factory to abstract OpenRouter/Mistral setup
      provide: 'LLM_MODEL',
      useFactory: (configService: ConfigService) =>
        createLlmModel(configService),
      inject: [ConfigService],
    },
  ],
})
export class ChatModule {}
