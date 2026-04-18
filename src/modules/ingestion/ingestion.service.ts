import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { VoyageAIClient } from 'voyageai';
import { createHash } from 'crypto';
import { Chunk } from './dto/ingestion.dto.js';

// ─── Chunking constants ───────────────────────────────────────────────────────

const CHUNK_SIZE = 500; // characters
const CHUNK_OVERLAP = 100; // characters (~20% overlap)

// ─── Separators used in recursive splitting (order matters) ──────────────────
// We try to split at natural boundaries first (paragraphs → sentences → words)
// before falling back to raw characters.

const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly collectionName: string;
  private readonly voyageModel: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('QDRANT_CLIENT') private readonly qdrantClient: QdrantClient,
    @Inject('VOYAGE_CLIENT') private readonly voyageClient: VoyageAIClient,
  ) {
    this.collectionName = this.configService.get<string>('QDRANT_COLLECTION')!;
    this.voyageModel = this.configService.get<string>('VOYAGE_MODEL')!;
  }

  // ─── 1. Chunking ────────────────────────────────────────────────────────────

  /**
   * Splits a plain-text article into overlapping chunks using recursive
   * character splitting — identical in spirit to LangChain's
   * RecursiveCharacterTextSplitter but without the dependency.
   *
   * Split hierarchy: paragraph → line → sentence → word → character
   */
  chunkText(text: string, sourceTitle: string): Chunk[] {
    const rawChunks = this.recursiveSplit(text, SEPARATORS, CHUNK_SIZE);

    return rawChunks
      .filter((t) => t.trim().length > 0)
      .map((t, i) => ({
        sourceTitle,
        sourceType: 'wikipedia' as const,
        chunkIndex: i,
        text: t.trim(),
      }));
  }

  /**
   * Core recursive splitter.
   * Tries each separator in order; recursively splits pieces that are still
   * too large. Merges small adjacent pieces using a sliding-window overlap.
   */
  private recursiveSplit(
    text: string,
    separators: string[],
    maxSize: number,
  ): string[] {
    if (text.length <= maxSize) return [text];

    const [separator, ...remainingSeparators] = separators;

    // If we have no separator left, fall back to hard character chunking
    if (separator === '' || separators.length === 0) {
      return this.hardChunk(text, maxSize, CHUNK_OVERLAP);
    }

    const splits = text.split(separator).filter((s) => s.length > 0);

    // If the separator produced no splits, try the next one
    if (splits.length <= 1) {
      return this.recursiveSplit(text, remainingSeparators, maxSize);
    }

    // Merge splits into chunks respecting maxSize, then apply overlap
    return this.mergeWithOverlap(splits, separator, maxSize);
  }

  /**
   * Hard-cut fallback: fixed-size chunks with overlap.
   * Only used when no natural separator reduces the piece below maxSize.
   */
  private hardChunk(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + size));
      start += size - overlap;
    }
    return chunks;
  }

  /**
   * Greedily merges an array of splits into chunks no larger than maxSize,
   * then creates overlap between consecutive chunks by carrying the tail of
   * the previous chunk into the start of the next one.
   */
  private mergeWithOverlap(
    splits: string[],
    separator: string,
    maxSize: number,
  ): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const split of splits) {
      const candidate =
        current.length > 0 ? current + separator + split : split;

      if (candidate.length <= maxSize) {
        current = candidate;
      } else {
        // Flush the current chunk
        if (current.length > 0) chunks.push(current);

        // If the single split itself exceeds maxSize, recurse into it
        if (split.length > maxSize) {
          const subChunks = this.recursiveSplit(split, [''], maxSize);
          chunks.push(...subChunks.slice(0, -1));
          current = subChunks[subChunks.length - 1] ?? '';
        } else {
          current = split;
        }
      }
    }

    if (current.length > 0) chunks.push(current);

    // Apply overlap: prepend tail of previous chunk to the next one
    return this.applyOverlap(chunks, CHUNK_OVERLAP);
  }

  /**
   * Given a list of clean chunks, builds an overlapping version by
   * prepending the last `overlap` characters of chunk[i] to chunk[i+1].
   */
  private applyOverlap(chunks: string[], overlap: number): string[] {
    if (chunks.length <= 1) return chunks;
    const result: string[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].slice(-overlap);
      result.push(tail + chunks[i]);
    }

    return result;
  }

  // ─── 2. Embedding ────────────────────────────────────────────────────────────

  /**
   * Embeds an array of chunks using Voyage AI in batches of 64.
   * Uses inputType 'document' for optimal indexing-time representation.
   * Returns a parallel array of 1024-dim vectors.
   */
  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    const BATCH_SIZE = 64;
    const vectors: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.text);

      this.logger.debug(
        `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${texts.length} chunks)`,
      );

      const response = await this.voyageClient.embed({
        input: texts,
        model: this.voyageModel,
        inputType: 'document',
      });

      const batchVectors =
        response.data?.map((d) => d.embedding as number[]) ?? [];
      vectors.push(...batchVectors);
    }

    return vectors;
  }

  // ─── 3. Qdrant — Collection setup ───────────────────────────────────────────

  /**
   * Creates the Qdrant collection if it does not already exist.
   * Idempotent — safe to call on every ingest run.
   * Vector size is 1024 to match voyage-4-lite's default output dimension.
   */
  async ensureCollection(): Promise<void> {
    const collections = await this.qdrantClient.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === this.collectionName,
    );

    if (exists) {
      this.logger.log(
        `Collection "${this.collectionName}" already exists — skipping creation`,
      );
      return;
    }

    await this.qdrantClient.createCollection(this.collectionName, {
      vectors: {
        size: 1024, // voyage-4-lite default output dimension
        distance: 'Cosine',
      },
    });

    this.logger.log(
      `Collection "${this.collectionName}" created (1024-dim, Cosine)`,
    );
  }

  // ─── 4. Qdrant — Upsert ─────────────────────────────────────────────────────

  /**
   * Upserts chunks + their vectors into Qdrant.
   * IDs are deterministic UUIDs derived from sourceTitle + chunkIndex,
   * ensuring re-runs are fully idempotent (upsert = insert or update).
   * Batches are 100 points per request.
   */
  async upsertToQdrant(chunks: Chunk[], vectors: number[][]): Promise<void> {
    const BATCH_SIZE = 100;

    const points = chunks.map((chunk, i) => ({
      id: this.deterministicUuid(`${chunk.sourceTitle}::${chunk.chunkIndex}`),
      vector: vectors[i],
      payload: {
        sourceTitle: chunk.sourceTitle,
        sourceType: chunk.sourceType,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      },
    }));

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      await this.qdrantClient.upsert(this.collectionName, { points: batch });
      this.logger.debug(`Upserted ${batch.length} points (offset ${i})`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Generates a UUID v5-compatible deterministic ID from a string.
   * Uses MD5 formatted as UUID to keep it simple and dependency-free.
   */
  private deterministicUuid(input: string): string {
    const hash = createHash('md5').update(input).digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      hash.slice(12, 16),
      hash.slice(16, 20),
      hash.slice(20, 32),
    ].join('-');
  }
}
