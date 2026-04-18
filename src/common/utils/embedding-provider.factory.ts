import { ConfigService } from '@nestjs/config';
import { VoyageAIClient } from 'voyageai';

/**
 * Factory to create the Voyage AI client for text embeddings.
 */
export function createEmbeddingClient(
  configService: ConfigService,
): VoyageAIClient {
  return new VoyageAIClient({
    apiKey: configService.get<string>('VOYAGE_API_KEY'),
  });
}
