import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service.js';

@Module({
  providers: [RetrievalService],
  exports: [RetrievalService], // Exported so ChatModule can use it in Phase 4
})
export class RetrievalModule {}
