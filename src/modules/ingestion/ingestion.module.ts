import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service.js';
import { createEmbeddingClient } from '../../common/utils/embedding-provider.factory.js';
import { createQdrantClient } from '../../common/utils/qdrant-provider.factory.js';

@Module({
  providers: [
    IngestionService,
    {
      provide: 'QDRANT_CLIENT',
      useFactory: (configService: ConfigService) =>
        createQdrantClient(configService),
      inject: [ConfigService],
    },
    {
      provide: 'VOYAGE_CLIENT',
      useFactory: (configService: ConfigService) =>
        createEmbeddingClient(configService),
      inject: [ConfigService],
    },
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
