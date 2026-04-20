import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createEmbeddingClient } from '../../common/utils/embedding-provider.factory.js';
import { createQdrantClient } from '../../common/utils/qdrant-provider.factory.js';
import { createLlmModel } from '../../common/utils/llm-provider.factory.js';

@Global() //@Global() to avoid needing to explicitly imports
@Module({
  providers: [
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
    {
      provide: 'LLM_MODEL',
      useFactory: (configService: ConfigService) =>
        createLlmModel(configService),
      inject: [ConfigService],
    },
  ],
  exports: ['QDRANT_CLIENT', 'VOYAGE_CLIENT', 'LLM_MODEL'],
})
export class CoreModule {}
