import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Factory to create the Qdrant vector database client instance.
 * It reads the required configuration from the environment variables.
 */
export function createQdrantClient(configService: ConfigService): QdrantClient {
  return new QdrantClient({
    url: configService.get<string>('QDRANT_URL'),
    apiKey: configService.get<string>('QDRANT_API_KEY'),
  });
}
