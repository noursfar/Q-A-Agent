import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetrievalService } from './retrieval.service.js';
import { createEmbeddingClient } from '../../common/utils/embedding-provider.factory.js';
import { createQdrantClient } from '../../common/utils/qdrant-provider.factory.js';

@Module({
  providers: [
    RetrievalService,
    {
      // Re-registering the Qdrant client factory
      provide: 'QDRANT_CLIENT',
      useFactory: (configService: ConfigService) =>
        createQdrantClient(configService),
      inject: [ConfigService],
    },
    {
      // Re-registering the Voyage client factory
      provide: 'VOYAGE_CLIENT',
      useFactory: (configService: ConfigService) =>
        createEmbeddingClient(configService),
      inject: [ConfigService],
    },
  ],
  exports: [RetrievalService], // Exported so ChatModule can use it in Phase 4
})
export class RetrievalModule {}
