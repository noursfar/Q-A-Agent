// ─── A chunk retrieved from Qdrant vector search ──────────────────────────────

export interface RetrievedChunk {
  sourceTitle: string;
  sourceType: string;
  chunkIndex: number;
  text: string;
  score: number; // Vector similarity score (from Qdrant)
}

// ─── A chunk after being scored by the Voyage Cross-Encoder Reranker ─────────

export interface RerankResult {
  sourceTitle: string;
  sourceType: string;
  chunkIndex: number;
  text: string;
  relevanceScore: number; // Reranker score (from Voyage rerank-2)
}
