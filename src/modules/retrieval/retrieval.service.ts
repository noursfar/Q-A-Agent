import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { VoyageAIClient } from 'voyageai';
import { RetrievedChunk, RerankResult } from './dto/retrieval.dto.js';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly collectionName: string;
  private readonly voyageModel: string;
  private readonly voyageRerankModel: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('QDRANT_CLIENT') private readonly qdrantClient: QdrantClient,
    @Inject('VOYAGE_CLIENT') private readonly voyageClient: VoyageAIClient,
  ) {
    this.collectionName = this.configService.get<string>('QDRANT_COLLECTION')!;
    this.voyageModel = this.configService.get<string>('VOYAGE_MODEL')!;
    this.voyageRerankModel = this.configService.get<string>('VOYAGE_RERANK_MODEL')!;
  }

  /**
   * Main entrypoint for RAG Retrieval.
   * 1. Embeds the user query
   * 2. Retrieves top-20 broad matches from Qdrant
   * 3. Reranks to the top-5 highly precise matches using Voyage rerank-2
   */
  async retrieve(query: string): Promise<RerankResult[]> {
    this.logger.debug(`Starting retrieval pipeline for query: "${query}"`);

    // Stage 1: Embed Query
    const queryVector = await this.embedQuery(query);

    // Stage 2: Broad Vector Retrieval (Top 20)
    const initialCandidates = await this.searchQdrant(queryVector, 20);
    this.logger.debug(
      `Retrieved ${initialCandidates.length} initial candidates from Qdrant`,
    );

    if (initialCandidates.length === 0) {
      return [];
    }

    // Stage 3: Cross-Encoder Reranking (Top 5)
    // The reranker is much slower but much more precise. We only run it on our 20 candidates.
    const rerankedChunks = await this.rerank(query, initialCandidates, 5);
    this.logger.debug(
      `Reranker distilled initial array down to top-5 results.`,
    );

    return rerankedChunks;
  }

  /**
   * Embeds a query using Voyage AI.
   * Note the inputType: 'query' — Voyage uses asymmetric optimizations meaning
   * search queries are embedded slightly differently than documents.
   */
  private async embedQuery(query: string): Promise<number[]> {
    const response = await this.voyageClient.embed({
      input: [query],
      model: this.voyageModel,
      inputType: 'query',
    });

    const vector = response.data?.[0]?.embedding;
    if (!vector) {
      throw new Error('Failed to generate query embedding from Voyage AI');
    }

    return vector;
  }

  /**
   * Hits Qdrant to find the nearest vectors to our query embedding using Cosine distance.
   */
  private async searchQdrant(
    vector: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const searchResults = await this.qdrantClient.search(this.collectionName, {
      vector,
      limit: topK,
      with_payload: true,
      with_vector: false, // We only need the text payload, not the vectors themselves
    });

    return searchResults.map((result) => ({
      sourceTitle: result.payload?.sourceTitle as string,
      sourceType: result.payload?.sourceType as string,
      chunkIndex: result.payload?.chunkIndex as number,
      text: result.payload?.text as string,
      score: result.score,
    }));
  }

  /**
   * Uses the Voyage generative cross-encoder to rescore candidate chunks.
   * Cross-encoders are highly accurate because they process the query and document
   * together through the model's attention mechanism (unlike raw dense vectors).
   */
  private async rerank(
    query: string,
    candidates: RetrievedChunk[],
    topK: number,
  ): Promise<RerankResult[]> {
    const documents = candidates.map((c) => c.text);

    const response = await this.voyageClient.rerank({
      query,
      documents,
      model: this.voyageRerankModel,
      topK: topK,
      returnDocuments: false, // We already map indices back below, saves network bandwidth
    });

    const results = response.data ?? [];

    // Map the returned rerank results back to our original candidate objects
    return results.map((res) => {
      // The SDK returns the index of the document from the array we fed it
      const originalCandidate = candidates[res.index ?? 0];
      return {
        ...originalCandidate,
        relevanceScore: res.relevanceScore ?? 0,
      };
    });
  }
}
