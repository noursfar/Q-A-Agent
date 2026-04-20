import { Module } from '@nestjs/common';
import { RetrievalModule } from '../retrieval/retrieval.module.js';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';

@Module({
  imports: [RetrievalModule], // Gives us access to RetrievalService
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
