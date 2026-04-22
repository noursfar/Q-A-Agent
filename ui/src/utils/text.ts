export const CITATION_REGEX = /\[Source:\s*([^\]]+)\]/g;
export const SPLIT_CITATION_REGEX = /(\[Source:\s*[^\]]+\])/g;
export const EXACT_CITATION_REGEX = /^\[Source:\s*([^\]]+)\]$/;

/**
 * Extracts a unique array of source titles from LLM text containing [Source: Title] references.
 */
export function extractUniqueSources(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(CITATION_REGEX)).map(m => m[1].trim())));
}
