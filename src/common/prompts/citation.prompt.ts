import { RerankResult } from '../../modules/retrieval/dto/retrieval.dto.js';

// ─── Source List Formatter ────────────────────────────────────────────────────

/**
 * Renders the available sources as a numbered reference list for the judge LLM.
 */
function formatSourceList(sources: RerankResult[]): string {
  return sources
    .map(
      (s, i) =>
        `[${i + 1}] Title: "${s.sourceTitle}" | Chunk: ${s.chunkIndex}\n    Excerpt: "${s.text.slice(0, 200).replace(/\n/g, ' ')}..."`,
    )
    .join('\n\n');
}

// ─── Citation Extraction Prompt Builder ──────────────────────────────────────

/**
 * Builds a prompt that instructs the LLM to act as a citation auditor.
 *
 * Given:
 *   - A generated answer string
 *   - The list of source chunks that were provided as context
 *
 * The LLM is asked to:
 *   1. Decompose the answer into individual factual claims
 *   2. Map each claim to its matching source from the list
 *   3. Flag any claims that cannot be traced (potential hallucinations)
 *   4. Return a structured JSON object
 *
 * This enables programmatic groundedness verification in the evaluation phase.
 */
export function buildCitationPrompt(
  answer: string,
  sources: RerankResult[],
): string {
  const sourceList = formatSourceList(sources);

  return `You are a meticulous citation auditor. Your job is to analyze an AI-generated answer and map every factual claim back to its original source document.

══════════════════════════════════════════════════════
TASK
══════════════════════════════════════════════════════

You will be given:
1. An AI-generated ANSWER
2. A list of SOURCE DOCUMENTS that were provided as context when generating the answer

Your task is to:

Step 1 — DECOMPOSE: Break the answer into individual, atomic factual claims. Ignore conjunctions, transitions, and non-factual sentences (e.g., "I will explain..." or "In summary...").

Step 2 — ATTRIBUTE: For each claim, identify which source document it came from based on semantic similarity and content overlap. A claim is "attributed" if its core information can be found in one of the source documents.

Step 3 — FLAG UNATTRIBUTED: If a claim cannot be traced to ANY of the provided sources, it is likely a hallucination or unsupported inference. Collect these in the "uncitedClaims" array.

══════════════════════════════════════════════════════
RULES
══════════════════════════════════════════════════════

- Be strict: only attribute a claim to a source if the information is clearly present in the excerpt. Do NOT infer or assume.
- Use the exact sourceTitle as it appears in the source list.
- Use the exact chunkIndex (the number after "Chunk:") from the source list.
- You MUST respond with valid JSON only. No preamble, no explanation outside the JSON block.

══════════════════════════════════════════════════════
OUTPUT FORMAT (strict JSON)
══════════════════════════════════════════════════════

{
  "citations": [
    {
      "claim": "<exact or paraphrased factual claim from the answer>",
      "sourceTitle": "<exact title from the source list>",
      "chunkIndex": <number>
    }
  ],
  "uncitedClaims": [
    "<any factual claim that could not be traced to any source>"
  ]
}

══════════════════════════════════════════════════════
FEW-SHOT EXAMPLE
══════════════════════════════════════════════════════

Sources:
  [1] Title: "Transformer (machine learning model)" | Chunk: 4
      Excerpt: "The Transformer model uses self-attention to relate positions in a sequence..."
  
  [2] Title: "Attention mechanism" | Chunk: 2
      Excerpt: "Attention was introduced to solve the bottleneck problem in encoder-decoder RNNs..."

Answer:
  "Transformers use self-attention to relate sequence positions [Source: Transformer (machine learning model)].
   The attention mechanism was invented by researchers at Stanford University.
   It addressed the bottleneck problem found in encoder-decoder RNNs [Source: Attention mechanism]."

Correct Output:
{
  "citations": [
    {
      "claim": "Transformers use self-attention to relate sequence positions",
      "sourceTitle": "Transformer (machine learning model)",
      "chunkIndex": 4
    },
    {
      "claim": "Attention addressed the bottleneck problem in encoder-decoder RNNs",
      "sourceTitle": "Attention mechanism",
      "chunkIndex": 2
    }
  ],
  "uncitedClaims": [
    "The attention mechanism was invented by researchers at Stanford University"
  ]
}

Note: The Stanford claim was NOT in any source, so it is flagged as uncited (potential hallucination).

══════════════════════════════════════════════════════
AVAILABLE SOURCES
══════════════════════════════════════════════════════

${sourceList}

══════════════════════════════════════════════════════
ANSWER TO AUDIT
══════════════════════════════════════════════════════

${answer}

══════════════════════════════════════════════════════

Now perform the citation audit. Respond with valid JSON only:`;
}
