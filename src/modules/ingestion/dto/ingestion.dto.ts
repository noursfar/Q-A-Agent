// ─── Raw Wikipedia article as saved by fetch-articles.ts ─────────────────────

export interface RawArticle {
  title: string;
  sourceType: 'wikipedia';
  fetchedAt: string;
  content: string;
}

// ─── A single chunk produced by the chunking logic ───────────────────────────

export interface Chunk {
  sourceTitle: string;
  sourceType: 'wikipedia';
  chunkIndex: number;
  text: string;
}
