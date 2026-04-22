import type { UIMessage } from 'ai';

// Citation extracted from the context by the RAG backend
export interface Citation {
  claim: string;
  sourceTitle: string;
  chunkIndex: number;
}

export interface CitationResult {
  citations: Citation[];
  uncitedClaims: string[];
}

// Session metadata for the sidebar
export interface SessionInfo {
  id: string;
  title: string;       // Typically the first user message, truncated
  createdAt: number;
}

// Custom UIMessage type extending standard AI SDK message
// We use a custom data part 'data-citations' for the citations result
export type ChatUIMessage = UIMessage<
  never,
  {
    citations: CitationResult;
  }
>;
